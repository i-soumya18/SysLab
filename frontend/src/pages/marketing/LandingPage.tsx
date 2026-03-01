import { useNavigate } from 'react-router-dom';
import { useFirebaseAuthContext } from '../../hooks/useFirebaseAuth';
import { useSEO } from '../../hooks/useSEO';
import { landingPageSEO } from '../../config/seoPages';

export function LandingPage() {
  useSEO(landingPageSEO);
  
  const navigate = useNavigate();
  const { user } = useFirebaseAuthContext();

  const handleGetStarted = () => {
    if (user) {
      navigate('/getting-started');
      return;
    }

    navigate('/dashboard');
  };

  return (
    <>
      {/* Hero Section */}
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
            Build a system.<br />
            Scale it.<br />
            <span className="text-blue-400">Watch it break.</span><br />
            <span className="text-green-400">Fix it.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-xl text-white/80">
            The System Design Flight Simulator that transforms abstract concepts into lived experience.
            Learn causality and engineering intuition through hands-on simulation.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <button
              onClick={user ? () => navigate('/getting-started') : handleGetStarted}
              className="rounded-lg bg-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-lg hover:bg-blue-700"
            >
              Start Simulating
            </button>
            <button
              onClick={() => navigate('/components')}
              className="rounded-lg border-2 border-white/30 bg-white/10 px-8 py-4 text-lg font-semibold text-white backdrop-blur-sm hover:bg-white/20"
            >
              Explore Components
            </button>
          </div>
        </div>

        {/* Visual Preview */}
        <div className="mt-20 rounded-xl border border-white/20 bg-white/5 p-8 backdrop-blur-sm">
          <div className="aspect-video rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
            <div className="text-center">
              <svg className="mx-auto h-24 w-24 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="mt-4 text-white/50">Interactive simulation preview</p>
            </div>
          </div>
        </div>
      </div>

      {/* Core Learning Loop */}
      <div className="border-t border-white/10 bg-white/5 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-bold text-white">
            The Core Learning Loop
          </h2>
          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-4">
            {[
              {title: 'Build', description: 'Drag components to create system architectures', icon: '🏗️'},
              {title: 'Scale', description: 'Test from 1 user to 1 billion users', icon: '📈'},
              {title: 'Break', description: 'Watch systems collapse under load', icon: '💥'},
              {title: 'Fix', description: 'Understand and resolve bottlenecks', icon: '🔧'}
            ].map((step, idx) => (
              <div key={idx} className="rounded-lg border border-white/20 bg-white/5 p-6 backdrop-blur-sm">
                <div className="text-4xl mb-4">{step.icon}</div>
                <h3 className="text-xl font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-white/70">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-bold text-white">
            Production-Ready Components
          </h2>
          <p className="text-center text-white/70 mt-4 max-w-2xl mx-auto">
            Build with industry-standard distributed system components that behave like real infrastructure.
          </p>
          <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              {name: 'Load Balancers', desc: 'Round-robin, least-connections, weighted distribution', color: 'blue'},
              {name: 'Databases', desc: 'ACID transactions, replication, connection pooling', color: 'green'},
              {name: 'Caches', desc: 'LRU/LFU eviction, hit ratios, cache warming', color: 'purple'},
              {name: 'Message Queues', desc: 'FIFO ordering, delivery guarantees, backpressure', color: 'yellow'},
              {name: 'CDN', desc: 'Geographic distribution, edge caching, origin requests', color: 'pink'},
              {name: 'Services', desc: 'Autoscaling, circuit breakers, timeout handling', color: 'orange'}
            ].map((component, idx) => (
              <div key={idx} className={`rounded-lg border border-${component.color}-500/20 bg-${component.color}-500/5 p-6`}>
                <h3 className="text-lg font-semibold text-white">{component.name}</h3>
                <p className="mt-2 text-sm text-white/70">{component.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center">
            <button
              onClick={() => navigate('/components')}
              className="rounded-lg bg-white/10 px-6 py-3 text-white hover:bg-white/20"
            >
              View Complete Component Library →
            </button>
          </div>
        </div>
      </div>

      {/* Success Metrics */}
      <div className="border-t border-white/10 bg-white/5 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-bold text-white">
            Learn System Design in Minutes, Not Months
          </h2>
          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
            {[
              {metric: '< 2 min', label: 'Time to First Simulation'},
              {metric: '1 → 1B', label: 'Scale Range (users)'},
              {metric: '< 100ms', label: 'Real-time Feedback'}
            ].map((stat, idx) => (
              <div key={idx} className="text-center">
                <div className="text-5xl font-bold text-blue-400">{stat.metric}</div>
                <div className="mt-2 text-white/70">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="py-24">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-white">
            Ready to stop memorizing and start understanding?
          </h2>
          <p className="mt-6 text-xl text-white/80">
            Join thousands of engineers building system design intuition through simulation.
          </p>
          <button
            onClick={user ? () => navigate('/getting-started') : handleGetStarted}
            className="mt-10 rounded-lg bg-blue-600 px-12 py-4 text-lg font-semibold text-white shadow-lg hover:bg-blue-700"
          >
            Start Free
          </button>
          <p className="mt-4 text-sm text-white/60">
            No credit card required • Unlimited simulations
          </p>
        </div>
      </div>

    </>
  );
}
