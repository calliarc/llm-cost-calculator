import Calculator from "@/components/Calculator";

export default function Page() {
  return (
    <main className="page">
      <header className="site-header">
        <h1>LLM Cost Calculator</h1>
        <p className="lede">
          Estimate the monthly API cost of your workload and compare it across
          providers and models, with prompt caching and batch pricing.
        </p>
      </header>

      <Calculator />

      <footer className="site-footer">
        <p>
          Open source under the MIT License.{" "}
          <a href="https://github.com/calliarc/llm-cost-calculator">Source and pricing data on GitHub</a>.
        </p>
        <p>
          Built and maintained by <a href="https://www.calliarc.com/">CalliArc</a>.
        </p>
      </footer>
    </main>
  );
}
