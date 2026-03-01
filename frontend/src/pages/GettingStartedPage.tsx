import { useNavigate } from 'react-router-dom';
import { useFirebaseAuthContext } from '../hooks/useFirebaseAuth';
import { useSEO } from '../hooks/useSEO';
import { gettingStartedSEO } from '../config/seoPages';

export function GettingStartedPage() {
  useSEO(gettingStartedSEO);
  
  const navigate = useNavigate();
  const { user } = useFirebaseAuthContext();

  const handleStartFirstWorkspace = () => {
    navigate('/dashboard');
  };

  return (
    <div className="bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:flex-row lg:px-8">
        <aside className="w-full rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:w-72">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Getting Started Tutorial
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Follow these steps to run your first end-to-end simulation.
          </p>
          <ol className="mt-6 space-y-3 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                1
              </span>
              <span>Create your first workspace</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                2
              </span>
              <span>Add components and connections on the canvas</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                3
              </span>
              <span>Run a simulation and inspect metrics</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                4
              </span>
              <span>Inject failures and observe bottlenecks</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                5
              </span>
              <span>Iterate on your design and export it</span>
            </li>
          </ol>

          <div className="mt-8 rounded-lg bg-blue-50 p-4 text-xs text-blue-900">
            <p className="font-semibold">Tip</p>
            <p className="mt-1">
              You can keep this page open in a separate tab while you work through the steps in your
              workspace.
            </p>
          </div>
        </aside>

        <main className="flex-1 space-y-8">
          <header>
            <p className="text-sm font-medium uppercase tracking-wide text-blue-600">
              Step-by-step guide
            </p>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">
              Getting started with System Design Simulator
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-gray-600">
              In this tutorial you will go from an empty account to running a live simulation with
              metrics, bottlenecks, and failure scenarios in just a few minutes.
            </p>
          </header>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">1. Create a workspace</h2>
            <p className="mt-2 text-sm text-gray-700">
              A workspace is your sandbox for a single system design. Each workspace contains a
              canvas, components, connections, and simulation configuration.
            </p>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-gray-700">
              <li>Open the Dashboard (top left logo or navigation).</li>
              <li>
                Click <span className="font-semibold">“Create New Workspace”</span> in the Quick
                Actions section.
              </li>
              <li>
                You will be redirected to the canvas view for your new workspace. The default
                workspace name and description can be changed later.
              </li>
            </ol>
            <button
              type="button"
              onClick={handleStartFirstWorkspace}
              className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Go to Dashboard to create a workspace
            </button>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">2. Add components to the canvas</h2>
            <p className="mt-2 text-sm text-gray-700">
              Components represent building blocks of your system such as clients, load balancers,
              web servers, databases, caches, and queues.
            </p>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-gray-700">
              <li>In your workspace, open the left “Components” sidebar.</li>
              <li>
                Drag at least one <span className="font-semibold">Client</span>, one{' '}
                <span className="font-semibold">Web Server</span>, and one{' '}
                <span className="font-semibold">Database</span> onto the canvas.
              </li>
              <li>
                Click a component to see its properties (capacity, latency, failure rate) in the
                right-hand Properties panel.
              </li>
              <li>
                Adjust capacity and latency values to roughly match the kind of system you want to
                simulate (for example: 1000 RPS web server, 5 ms cache, 20 ms database).
              </li>
            </ol>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">3. Connect components</h2>
            <p className="mt-2 text-sm text-gray-700">
              Connections model network links between components and define bandwidth, latency, and
              reliability characteristics.
            </p>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-gray-700">
              <li>Use the canvas connection tool to connect Client → Web Server → Database.</li>
              <li>
                For each connection, configure:
                <ul className="mt-1 list-disc pl-5">
                  <li>Bandwidth in requests per second.</li>
                  <li>Network latency between components.</li>
                  <li>Protocol (HTTP, TCP, DATABASE, etc.).</li>
                </ul>
              </li>
              <li>
                Keep things simple for your first run: choose relatively low latency (e.g. 10–30ms)
                and high reliability.
              </li>
            </ol>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">4. Configure scale and run a simulation</h2>
            <p className="mt-2 text-sm text-gray-700">
              The Scale control determines how many virtual users and requests per second will hit
              your system.
            </p>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-gray-700">
              <li>Use the Scale slider on the right to choose a user count (for example, 100).</li>
              <li>
                Click <span className="font-semibold">“Run”</span> in the top toolbar. The
                simulation engine will start sending traffic through your design.
              </li>
              <li>
                Watch the status indicator in the toolbar and the elapsed time counter in the right
                sidebar to confirm the simulation is running.
              </li>
            </ol>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">5. Inspect metrics, bottlenecks, and failures</h2>
            <p className="mt-2 text-sm text-gray-700">
              While the simulation is running you can see live metrics, bottlenecks, and failures in
              multiple dashboards.
            </p>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-gray-700">
              <li>
                Open the <span className="font-semibold">Panels</span> menu in the top toolbar and
                enable the <span className="font-semibold">Metrics Dashboard</span>.
              </li>
              <li>
                Watch system-wide throughput, latency, and error rate as they update in real time.
              </li>
              <li>
                Use the <span className="font-semibold">Bottleneck Visualizer</span> and{' '}
                <span className="font-semibold">System Health</span> tab to see which components are
                limiting performance.
              </li>
              <li>
                Optionally open the <span className="font-semibold">Failure Injection</span> panel
                and introduce slowdowns, crashes, or network partitions to see how your design
                behaves under stress.
              </li>
            </ol>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">6. Save, export, and iterate</h2>
            <p className="mt-2 text-sm text-gray-700">
              Once you are happy with a design or want to compare alternatives, you can save,
              export, and version your workspace.
            </p>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-gray-700">
              <li>
                Use the <span className="font-semibold">Export</span> button in the workspace
                toolbar to download a JSON snapshot of your design.
              </li>
              <li>
                Reopen the Dashboard to see your workspace in the{' '}
                <span className="font-semibold">Recent Workspaces</span> list.
              </li>
              <li>
                Create new workspaces to explore alternative architectures, scale profiles, and
                failure strategies.
              </li>
            </ol>
            <p className="mt-4 text-sm text-gray-700">
              From here you can dive into the scenario library, progressive constraints, and
              advanced metrics to deepen your system design intuition.
            </p>
          </section>

          <section className="mb-8 rounded-xl border border-blue-100 bg-blue-50 p-6 text-sm text-blue-900">
            <h2 className="text-base font-semibold">Next steps</h2>
            <ul className="mt-3 list-disc pl-5 space-y-1">
              <li>Create at least two different designs for the same problem and compare metrics.</li>
              <li>Use failure injection to practice handling outages and slow dependencies.</li>
              <li>Explore the scenario library to work through structured challenges.</li>
            </ul>
            {!user && (
              <p className="mt-3">
                To save your workspaces over time, sign in from the landing page and then create
                your first workspace.
              </p>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

