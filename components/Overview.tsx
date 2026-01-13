"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis
} from 'recharts';

import React from 'react';

interface OverviewProps {
  data: any[];
}

const Overview: React.FC<OverviewProps> = ({ data }) => {
  return (
    Array.isArray(data) && data.length > 0 ? (
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={data}>
          <XAxis
            dataKey="name"
            stroke="#888888"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#888888"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `$${ value.toFixed(2) }`}
          />
          <Bar dataKey="total" fill="#3498db" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    ) : (
      <p style={{ textAlign: "center", color: "#888", marginTop: "1rem" }}>
        📉 No revenue data yet for this period
      </p>
    )
  );
};

export default Overview