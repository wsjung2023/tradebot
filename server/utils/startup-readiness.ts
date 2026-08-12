type StartupReadinessOptions = {
  startedAt: string;
  buildVersion: string | null;
};

export function createStartupReadiness(options: StartupReadinessOptions) {
  let ready = false;

  return {
    markReady(): void {
      ready = true;
    },

    getHealthResponse() {
      return {
        statusCode: ready ? 200 : 503,
        body: {
          ok: ready,
          status: ready ? "ready" : "starting",
          buildVersion: options.buildVersion,
          startedAt: options.startedAt,
        },
      };
    },
  };
}
