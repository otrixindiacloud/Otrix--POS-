/**
 * React Infinite Loop Debugger
 * 
 * This script helps identify infinite loops by tracking component renders
 * and useEffect executions. Add it to your component to debug.
 */

let renderCounts = new Map<string, number>();
let effectCounts = new Map<string, number>();
let lastLogTime = Date.now();

export function debugRender(componentName: string, props?: any) {
  const count = (renderCounts.get(componentName) || 0) + 1;
  renderCounts.set(componentName, count);
  
  const now = Date.now();
  const timeSinceLastLog = now - lastLogTime;
  
  // If component renders more than 50 times in 1 second, we likely have an infinite loop
  if (count > 50 && timeSinceLastLog < 1000) {
    console.error(`🔴 INFINITE LOOP DETECTED in ${componentName}!`);
    console.error(`Rendered ${count} times in ${timeSinceLastLog}ms`);
    console.error('Props:', props);
    console.trace('Call stack:');
    
    // Reset counter to avoid spamming console
    renderCounts.set(componentName, 0);
    lastLogTime = now;
  } else if (count % 10 === 0) {
    console.warn(`⚠️ ${componentName} has rendered ${count} times`);
  }
  
  // Reset counters every 5 seconds
  if (timeSinceLastLog > 5000) {
    renderCounts.clear();
    effectCounts.clear();
    lastLogTime = now;
  }
}

export function debugEffect(componentName: string, effectName: string, dependencies: any[]) {
  const key = `${componentName}::${effectName}`;
  const count = (effectCounts.get(key) || 0) + 1;
  effectCounts.set(key, count);
  
  const now = Date.now();
  const timeSinceLastLog = now - lastLogTime;
  
  // If effect runs more than 50 times in 1 second, we likely have an infinite loop
  if (count > 50 && timeSinceLastLog < 1000) {
    console.error(`🔴 INFINITE LOOP DETECTED in ${componentName}.${effectName}!`);
    console.error(`Effect ran ${count} times in ${timeSinceLastLog}ms`);
    console.error('Dependencies:', dependencies);
    console.trace('Call stack:');
    
    // Reset counter to avoid spamming console
    effectCounts.set(key, 0);
    lastLogTime = now;
  } else if (count % 10 === 0) {
    console.warn(`⚠️ ${componentName}.${effectName} has run ${count} times`);
    console.warn('Dependencies:', dependencies);
  }
}

export function clearDebugCounters() {
  renderCounts.clear();
  effectCounts.clear();
  lastLogTime = Date.now();
}

/**
 * Usage example:
 * 
 * function MyComponent({ prop1, prop2 }) {
 *   debugRender('MyComponent', { prop1, prop2 });
 * 
 *   useEffect(() => {
 *     debugEffect('MyComponent', 'myEffect', [prop1, prop2]);
 *     // ... effect code
 *   }, [prop1, prop2]);
 * 
 *   return <div>...</div>;
 * }
 */
