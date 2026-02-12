import React, { useMemo } from 'react';
import type { Component } from '../types';

interface CostDashboardProps {
  components: Component[];
  userCount: number;
}

type CostBreakdown = {
  compute: number;
  storage: number;
  network: number;
  total: number;
};

const HOURLY_COMPUTE_COST_BY_TYPE: Record<string, number> = {
  database: 0.25,
  'web-server': 0.1,
  'load-balancer': 0.08,
  cache: 0.07,
  'message-queue': 0.06,
  cdn: 0.05,
  client: 0.0,
  proxy: 0.05
};

export const CostDashboard: React.FC<CostDashboardProps> = ({ components, userCount }) => {
  const cost: CostBreakdown = useMemo(() => {
    if (components.length === 0 || userCount <= 0) {
      return { compute: 0, storage: 0, network: 0, total: 0 };
    }

    const compute = components.reduce((sum, component) => {
      const baseCost = HOURLY_COMPUTE_COST_BY_TYPE[component.type] ?? 0.08;
      const capacityFactor = Math.max(1, component.configuration.capacity / 100);
      return sum + (baseCost * capacityFactor);
    }, 0);

    const estimatedDataGBPerHour = (userCount * 0.01);
    const storage = estimatedDataGBPerHour * 0.02;
    const network = estimatedDataGBPerHour * 0.09;

    const total = compute + storage + network;

    return { compute, storage, network, total };
  }, [components, userCount]);

  if (components.length === 0 || userCount <= 0) {
    return null;
  }

  const monthlyTotal = cost.total * 24 * 30;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        width: '360px',
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #e0e0e0',
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
        padding: '12px 14px',
        fontFamily: 'Arial, sans-serif',
        zIndex: 998
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '16px' }}>💰</span>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#333' }}>
            Cost Modeling (Approx.)
          </h3>
        </div>
        <span style={{ fontSize: '11px', color: '#868e96' }}>
          {userCount.toLocaleString()} users
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          marginBottom: '8px'
        }}
      >
        <div
          style={{
            padding: '6px 8px',
            borderRadius: '4px',
            backgroundColor: '#e3f2fd',
            borderLeft: '3px solid #1e88e5'
          }}
        >
          <div style={{ fontSize: '11px', color: '#555' }}>Hourly Total</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e88e5' }}>
            ${cost.total.toFixed(3)}
          </div>
        </div>
        <div
          style={{
            padding: '6px 8px',
            borderRadius: '4px',
            backgroundColor: '#e8f5e9',
            borderLeft: '3px solid #43a047'
          }}
        >
          <div style={{ fontSize: '11px', color: '#555' }}>Monthly Estimate</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#2e7d32' }}>
            ${monthlyTotal.toFixed(2)}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '6px',
          fontSize: '11px',
          color: '#495057'
        }}
      >
        <div>
          <div style={{ marginBottom: '2px' }}>Compute</div>
          <div style={{ fontWeight: 'bold' }}>${cost.compute.toFixed(3)}/hr</div>
        </div>
        <div>
          <div style={{ marginBottom: '2px' }}>Storage</div>
          <div style={{ fontWeight: 'bold' }}>${cost.storage.toFixed(3)}/hr</div>
        </div>
        <div>
          <div style={{ marginBottom: '2px' }}>Network</div>
          <div style={{ fontWeight: 'bold' }}>${cost.network.toFixed(3)}/hr</div>
        </div>
      </div>

      <div style={{ marginTop: '6px', fontSize: '10px', color: '#868e96' }}>
        Estimates are educational and based on simplified cloud pricing for this workspace layout.
      </div>
    </div>
  );
};

export default CostDashboard;

