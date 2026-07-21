import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { Download, Search } from "lucide-react";
import { useParticipants } from "@/hooks/useParticipants";
import { useLotteries } from "@/hooks/useLotteries";
import { useRealtime } from "@/hooks/useRealtime";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDollars, formatDate } from "@/lib/utils";
import type { ParticipantRow } from "@/types/database";

const PAGE_SIZE = 50;

export function ParticipantsPage() {
  const { data: lotteries } = useLotteries(["open", "paused", "closed", "completed"]);
  const [lotteryId, setLotteryId] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  useRealtime(lotteryId);

  const { data, isLoading } = useParticipants({
    lotteryId,
    search,
    page,
    pageSize: PAGE_SIZE,
  });

  const columns = useMemo<ColumnDef<ParticipantRow>[]>(
    () => [
      { accessorKey: "ticket_number", header: "Ticket", cell: (c) => `#${c.getValue<number>()}` },
      {
        accessorKey: "amount_cents",
        header: "Amount",
        cell: (c) => formatDollars(c.getValue<number>() / 100),
      },
      { accessorKey: "first_name", header: "First" },
      { accessorKey: "last_name", header: "Last" },
      { accessorKey: "phone", header: "Phone" },
      { accessorKey: "email", header: "Email", cell: (c) => c.getValue<string>() ?? "—" },
      {
        accessorKey: "channel",
        header: "Channel",
        cell: (c) => <Badge variant="outline">{c.getValue<string>()}</Badge>,
      },
      {
        accessorKey: "payment_status",
        header: "Payment",
        cell: (c) => {
          const v = c.getValue<string>();
          return (
            <Badge variant={v === "captured" ? "success" : v === "failed" ? "destructive" : "secondary"}>
              {v}
            </Badge>
          );
        },
      },
      { accessorKey: "created_at", header: "Registered", cell: (c) => formatDate(c.getValue<string>()) },
    ],
    [],
  );

  const table = useReactTable({
    data: data?.rows ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const exportCsv = () => {
    const rows = data?.rows ?? [];
    const header = ["Ticket", "Amount", "First", "Last", "Phone", "Email", "Channel", "Status", "Registered"];
    const lines = rows.map((r) =>
      [
        r.ticket_number,
        r.amount_cents / 100,
        r.first_name,
        r.last_name,
        r.phone,
        r.email ?? "",
        r.channel,
        r.payment_status,
        r.created_at,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `participants-page-${page + 1}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, phone, email…"
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={lotteryId ?? ""}
          onChange={(e) => {
            setLotteryId(e.target.value || undefined);
            setPage(0);
          }}
        >
          <option value="">All lotteries</option>
          {lotteries?.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <Button variant="outline" onClick={exportCsv} className="gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((h) => (
                      <th key={h.id} className="px-4 py-3 text-left font-medium">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td colSpan={columns.length} className="px-4 py-3">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))
                ) : table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="border-b hover:bg-muted/30">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">
                      No participants found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} total · Page {page + 1} of {totalPages}</span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
