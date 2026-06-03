export default function HowScoringWorksPage() {
  return (
    <div className="px-8 py-6 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">How Scoring Works</h1>
        <p className="text-gray-400 text-sm mt-0.5">Understanding your accessibility score</p>
      </div>

      <div className="space-y-6">

        {/* Overview */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Overview</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Every site starts with a perfect score of <span className="font-semibold text-gray-900">100</span>.
            Points are deducted for each unique type of accessibility violation found across your pages.
            The score reflects how many distinct issues exist — not how many times each issue appears —
            so fixing a rule type improves your score regardless of how many pages it affected.
          </p>
        </div>

        {/* Deductions */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Point Deductions by Severity</h2>
          <div className="space-y-3">
            {[
              { level: 'Critical', points: 8, color: '#4338ca', desc: 'Blocks access entirely for users with disabilities. Example: interactive elements with no accessible name.' },
              { level: 'Serious', points: 5, color: '#2563eb', desc: 'Significantly impairs access. Example: insufficient color contrast on body text.' },
              { level: 'Moderate', points: 2, color: '#0ea5e9', desc: 'Creates friction or confusion. Example: form fields missing labels.' },
              { level: 'Minor', points: 0.5, color: '#22d3ee', desc: 'Best-practice issues with limited impact. Example: redundant alt text.' },
            ].map(({ level, points, color, desc }) => (
              <div key={level} className="flex gap-4 items-start">
                <div className="flex items-center gap-2 w-36 shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-sm font-medium text-gray-700">{level}</span>
                </div>
                <div className="flex items-center gap-2 w-16 shrink-0">
                  <span className="text-sm font-semibold text-gray-900">−{points}</span>
                  <span className="text-xs text-gray-400">pts</span>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Example */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Example</h2>
          <p className="text-sm text-gray-600 mb-4">A site with the following unique violation types would score:</p>
          <div className="bg-gray-50 rounded-lg p-4 text-sm font-mono space-y-1 text-gray-700">
            <div>100 (start)</div>
            <div className="text-gray-400">− 8 &nbsp; color-contrast <span className="text-indigo-500">[critical]</span></div>
            <div className="text-gray-400">− 5 &nbsp; button-name &nbsp;&nbsp; <span className="text-blue-500">[serious]</span></div>
            <div className="text-gray-400">− 2 &nbsp; label &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <span className="text-sky-500">[moderate]</span></div>
            <div className="border-t border-gray-200 pt-1 font-semibold text-gray-900">= 85</div>
          </div>
        </div>

        {/* Grade scale */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Grade Scale</h2>
          <div className="grid grid-cols-5 gap-2">
            {[
              { grade: 'A', range: '90–100', color: 'text-green-600', bg: 'bg-green-50' },
              { grade: 'B', range: '80–89',  color: 'text-lime-600',  bg: 'bg-lime-50' },
              { grade: 'C', range: '70–79',  color: 'text-yellow-600', bg: 'bg-yellow-50' },
              { grade: 'D', range: '60–69',  color: 'text-orange-500', bg: 'bg-orange-50' },
              { grade: 'F', range: '0–59',   color: 'text-red-500',   bg: 'bg-red-50' },
            ].map(({ grade, range, color, bg }) => (
              <div key={grade} className={`${bg} rounded-lg p-3 text-center`}>
                <div className={`text-2xl font-bold ${color}`}>{grade}</div>
                <div className="text-xs text-gray-500 mt-1">{range}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Standard */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Standard</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Scans run against <span className="font-semibold text-gray-900">WCAG 2.2 AA</span> using
            axe-core with tags <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">wcag2a</code>,{' '}
            <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">wcag2aa</code>,{' '}
            <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">wcag21a</code>,{' '}
            <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">wcag21aa</code>,{' '}
            <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">wcag22aa</code>, and{' '}
            <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">best-practice</code>.
            Pages are rendered with full JavaScript execution before scanning.
          </p>
        </div>

      </div>
    </div>
  )
}
