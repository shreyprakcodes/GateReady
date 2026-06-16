"use client";

import { useState, useEffect } from "react";

export function GreetingText({ name }: { name: string }) {
  const [label, setLabel] = useState("Hello");

  useEffect(() => {
    const h = new Date().getHours();
    setLabel(h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");
  }, []);

  return (
    <>
      {label}, <span style={{ color: "#1A1A2E" }}>{name}</span>
    </>
  );
}
