export const DEFAULT_SIMULATION_CODE = `function add(a, b) {
  return a + b;
}

const result = add(2, 3);
console.log(result);

queueMicrotask(() => {
  console.log("microtask fired");
});

setTimeout(() => {
  console.log("macrotask fired");
}, 0);`;
