/**
 * OTel tracing bootstrap for loopat-server.
 *
 * Controlled by OTEL_TRACES_EXPORTER env:
 *   - "console" → ConsoleSpanExporter (stdout)
 *   - "otlp"    → OTLP/HTTP exporter (Jaeger, Grafana Tempo, etc.)
 *   - unset/"none" → noop tracer, zero overhead
 *
 * Import at the top of the entry point (before app code) so the
 * provider is registered before the first span fires.
 */
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node"
import {
  SimpleSpanProcessor,
  BatchSpanProcessor,
  ConsoleSpanExporter,
} from "@opentelemetry/sdk-trace-node"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { trace, SpanStatusCode, SpanKind, type Span, type Tracer, type Attributes } from "@opentelemetry/api"
import { Resource } from "@opentelemetry/resources"
import type { MiddlewareHandler } from "hono"

const exporterName = (process.env.OTEL_TRACES_EXPORTER ?? "none").toLowerCase()

let _provider: NodeTracerProvider | null = null

if (exporterName !== "none") {
  const resource = new Resource({ "service.name": "loopat-server" })
  const provider = new NodeTracerProvider({ resource })

  if (exporterName === "console") {
    // SimpleSpanProcessor for console: flush immediately so output appears inline.
    provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()))
  } else if (exporterName === "otlp") {
    // BatchSpanProcessor for network exporters: buffers spans, flushes in batches.
    provider.addSpanProcessor(
      new BatchSpanProcessor(
        new OTLPTraceExporter({
          url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318/v1/traces",
        }),
      ),
    )
  }

  provider.register()
  _provider = provider
}

export const tracer: Tracer = trace.getTracer("loopat", "0.1.0")

export async function shutdownTracing(): Promise<void> {
  await _provider?.shutdown()
}

export async function withSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      return await fn(span)
    } catch (e) {
      span.recordException(e as Error)
      span.setStatus({ code: SpanStatusCode.ERROR, message: (e as Error).message })
      throw e
    } finally {
      span.end()
    }
  })
}

/**
 * Hono middleware that wraps each request in an OTel span.
 * Span name = "HTTP {method} {path}", attributes follow semconv.
 */
export function traceMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const method = c.req.method
    const path = c.req.path
    const attrs: Attributes = {
      "http.method": method,
      "http.target": path,
      "http.url": c.req.url,
    }
    await tracer.startActiveSpan(`HTTP ${method} ${path}`, { kind: SpanKind.SERVER, attributes: attrs }, async (span) => {
      try {
        await next()
        span.setAttribute("http.status_code", c.res.status)
        if (c.res.status >= 500) {
          span.setStatus({ code: SpanStatusCode.ERROR })
        }
      } catch (e) {
        span.recordException(e as Error)
        span.setStatus({ code: SpanStatusCode.ERROR, message: (e as Error).message })
        throw e
      } finally {
        span.end()
      }
    })
  }
}
