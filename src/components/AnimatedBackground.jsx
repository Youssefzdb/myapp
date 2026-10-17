import React from 'react';

export default function AnimatedBackground() {
  return (
    <div aria-hidden="true" className="home-animated-background pointer-events-none fixed inset-0 z-0 overflow-hidden bg-background">
      <div className="home-background-orb home-background-orb-coral" />
      <div className="home-background-orb home-background-orb-teal" />
      <div className="home-background-orb home-background-orb-blue" />
      <div className="home-background-grid absolute inset-0" />
    </div>
  );
}