"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { CareerProgressionItem } from "@/types";

interface SalaryChartProps {
    progression: CareerProgressionItem[];
}

export default function SalaryChart({ progression }: SalaryChartProps) {
    // Transform data for chart
    const chartData = progression.map((item, index) => {
        // Extract mid-point of salary range
        const rangeParts = item.estimated_ctc_range.split("–").map((s) => parseFloat(s.trim()));
        const midSalary = (rangeParts[0] + (rangeParts[1] || rangeParts[0])) / 2;

        return {
            year: `Y${index + 1}`,
            salary: midSalary,
            role: item.role.length > 20 ? item.role.substring(0, 20) + "..." : item.role,
        };
    });

    return (
        <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
            <h4 className="text-lg font-semibold text-white mb-4">Salary Progression</h4>
            <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="year" stroke="#94a3b8" style={{ fontSize: "12px" }} />
                    <YAxis stroke="#94a3b8" style={{ fontSize: "12px" }} label={{ value: "₹L", angle: -90, position: "insideLeft", fill: "#94a3b8" }} />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: "#1e293b",
                            border: "1px solid #475569",
                            borderRadius: "8px",
                            color: "#fff",
                        }}
                        formatter={(value: number) => [`₹${value}L`, "Salary"]}
                    />
                    <Line
                        type="monotone"
                        dataKey="salary"
                        stroke="#8b5cf6"
                        strokeWidth={3}
                        dot={{ fill: "#8b5cf6", r: 5 }}
                        activeDot={{ r: 7 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}