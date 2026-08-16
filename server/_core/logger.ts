type LogLevel = "INFO" | "WARN" | "ERROR";

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { value: String(error) };
}

export function appLog(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: "marketing-hub",
    message,
    ...(context ? { context } : {}),
  };
  const output = JSON.stringify(entry);
  if (level === "ERROR") console.error(output);
  else if (level === "WARN") console.warn(output);
  else console.log(output);
}

export function appError(message: string, error: unknown, context?: Record<string, unknown>) {
  appLog("ERROR", message, { ...context, error: serializeError(error) });
}

export function registerProcessLogging() {
  process.on("uncaughtException", error => {
    appError("Exceção não tratada no processo", error);
  });
  process.on("unhandledRejection", reason => {
    appError("Rejeição de Promise não tratada", reason);
  });
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => {
      appLog("WARN", "Processo recebendo sinal de desligamento", { signal });
    });
  }
}
