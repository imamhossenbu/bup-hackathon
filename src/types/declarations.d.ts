declare module 'javascript-lp-solver' {
  const solver: {
    Solve(model: any): any;
    Model: any;
  };
  export default solver;
  export = solver;
}
