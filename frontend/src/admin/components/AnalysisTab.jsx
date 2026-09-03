import { useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { adminFetch, apiPath } from '../adminUtils';
import { DashboardTab } from './DashboardTab';

export function AnalysisTab({ overview, authHeaders }) {
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    const response = await adminFetch(apiPath('/api/admin/analysis/ai'), { method: 'POST', headers: authHeaders });
    const data = await response.json();
    setAnalysis(typeof data.analysis === 'string' ? data.analysis : JSON.stringify(data.analysis, null, 2));
    setLoading(false);
  };

  return (
    <section className="admin-panel analysis-panel">
      <h2>Offline analysis</h2>
      <DashboardTab overview={overview} />
      <button className="button button-primary" onClick={run} disabled={loading}>
        {loading ? 'Analyzing...' : 'Analyze registrations offline'} <Icon name="shield" />
      </button>
      {analysis && <pre>{analysis}</pre>}
    </section>
  );
}
