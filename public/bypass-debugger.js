// 在页面脚本执行之前，劫持通过 setInterval/setTimeout 注入的 debugger 调用
(function () {
  const originalSetInterval = window.setInterval;
  const originalSetTimeout = window.setTimeout;

  function containsDebugger(fn: unknown): boolean {
    if (typeof fn !== 'function') return false;
    try { return fn.toString().includes('debugger'); } catch { return true; }
  }

  window.setInterval = function (fn: TimerHandler, delay?: number, ...args: unknown[]): number {
    if (containsDebugger(fn)) return 0;
    return originalSetInterval.call(window, fn, delay, ...args);
  };

  window.setTimeout = function (fn: TimerHandler, delay?: number, ...args: unknown[]): number {
    if (containsDebugger(fn)) return 0;
    return originalSetTimeout.call(window, fn, delay, ...args);
  };
})();
