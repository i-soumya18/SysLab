import { useNavigate } from 'react-router-dom';

export function AboutPage() {
  const navigate = useNavigate();

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-extrabold text-gray-900">About System Design Simulator</h1>
        
        <div className="mt-8 space-y-6 text-lg text-gray-700">
          <p>
            System Design Simulator is the world's first interactive learning platform that transforms
            abstract system design concepts into lived experience. We believe that the best way to learn
            system design is through hands-on simulation, not memorization.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-12">Our Mission</h2>
          <p>
            To democratize system design education by providing an intuitive, interactive platform where
            anyone can build, scale, break, and fix distributed systems - experiencing the "why" behind
            architectural decisions through direct interaction.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-12">The Problem We Solve</h2>
          <p>
            Traditional system design education relies on static diagrams and theoretical knowledge. Students
            memorize patterns without understanding causality, tradeoffs, and the engineering intuition needed
            for real-world challenges. There was no platform that implemented the natural learning loop:
          </p>
          <div className="bg-blue-50 rounded-lg p-6 my-6">
            <p className="text-center text-xl font-semibold text-blue-900">
              Build → Scale → Break → Observe → Fix → Repeat
            </p>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mt-12">Our Approach</h2>
          <p>
            We provide a drag-and-drop canvas with industry-standard components (Load Balancers, Databases,
            Caches, Queues, CDNs, Services) that behave like real infrastructure. Users can simulate traffic
            from 1 user to 1 billion users, inject realistic failures, and observe system behavior in real-time.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-12">Built for Learners</h2>
          <p>
            Whether you're a student learning the fundamentals, an engineer preparing for interviews, or a team
            lead designing a new system, our platform helps you develop engineering intuition through experiential
            learning. No memorization required - just build, experiment, and understand.
          </p>

          <div className="mt-12 rounded-lg bg-gray-50 p-8 text-center">
            <p className="text-2xl font-semibold text-gray-900">
              Ready to stop memorizing and start understanding?
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="mt-6 rounded-lg bg-blue-600 px-8 py-3 text-lg font-semibold text-white hover:bg-blue-700"
            >
              Start Learning
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
