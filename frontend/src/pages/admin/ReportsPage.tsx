import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLotteries } from "@/hooks/useLotteries";
import { useLotteryStats } from "@/hooks/useLotteryStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/utils";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444"];

export function ReportsPage() {
  const { data: lotteries } = useLotteries(["open", "paused", "closed", "completed"]);
  const [id, setId] = useState<string | undefined>();
  const activeId = id ?? lotteries?.[0]?.id;
  const { data: stats } = useLotteryStats(activeId);
  const selected = lotteries?.find((l) => l.id === activeId);

  const range = selected ? selected.max_charge - selected.min_charge + 1 : 0;
  const sold = stats ? Number(stats.total_participants) : 0;

  const channelData = [
    { name: "Phone", value: stats ? Number(stats.phone_count) : 0 },
    { name: "Web", value: stats ? Number(stats.web_count) : 0 },
  ];
  const ticketData = [
    { name: "Sold", value: sold },
    { name: "Remaining", value: Math.max(0, range - sold) },
  ];
  const chargeData = stats
    ? [
        { name: "Lowest", value: Number(stats.lowest_charge_cents) / 100 },
        { name: "Average", value: Number(stats.average_charge_cents) / 100 },
        { name: "Highest", value: Number(stats.highest_charge_cents) / 100 },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Reports</h2>
        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={activeId ?? ""}
          onChange={(e) => setId(e.target.value)}
        >
          {lotteries?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">Total Revenue</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">
            {stats ? formatCents(Number(stats.total_revenue_cents)) : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Completion</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">
            {range ? Math.round((sold / range) * 100) : 0}%
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Participants</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{sold}</CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Ticket Distribution</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={ticketData} dataKey="value" nameKey="name" outerRadius={90} label>
                  {ticketData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Channel Breakdown</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={channelData} dataKey="value" nameKey="name" outerRadius={90} label>
                  {channelData.map((_, i) => <Cell key={i} fill={COLORS[(i + 1) % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Charge Distribution ($)</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chargeData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
