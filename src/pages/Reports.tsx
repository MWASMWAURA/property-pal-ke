import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, FileBarChart, TrendingUp, Home, Receipt, Wrench } from "lucide-react";
import { useData } from "@/lib/data-store";
import { toast } from "@/hooks/use-toast";

// Utility function to convert data to CSV
const arrayToCSV = (data: any[], headers?: string[]) => {
  if (data.length === 0) return '';

  const csvHeaders = headers || Object.keys(data[0]);
  const csvRows = data.map(row =>
    csvHeaders.map(header => {
      const value = row[header] || '';
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',')
  );

  return [csvHeaders.join(','), ...csvRows].join('\n');
};

// Utility function to download CSV file
const downloadCSV = (filename: string, csvContent: string) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const Reports = () => {
  const { tenants, payments, complaints, maintenance, properties } = useData();
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{ name: string; data: string[][] } | null>(null);

  // Report generation functions
  const generateCollectionsReport = () => {
    const data = payments.map(payment => ({
      Date: new Date(payment.paidAt).toLocaleDateString(),
      Tenant: payment.tenantName,
      Amount: payment.amount,
      Method: payment.method,
      Period: payment.period,
      Status: payment.status,
      Reference: payment.reference || ''
    }));
    return arrayToCSV(data);
  };

  const generateOccupancyReport = () => {
    const data = tenants.map(tenant => ({
      Name: tenant.name,
      Property: tenant.property,
      Unit: tenant.unit,
      'Monthly Rent': tenant.rent,
      Status: tenant.status,
      'Lease End': tenant.leaseEnd
    }));
    return arrayToCSV(data);
  };

  const generateRevenueStatement = () => {
    const monthlyRevenue = payments.reduce((acc, payment) => {
      if (payment.status === 'paid') {
        const month = new Date(payment.paidAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        acc[month] = (acc[month] || 0) + payment.amount;
      }
      return acc;
    }, {} as Record<string, number>);

    const data = Object.entries(monthlyRevenue).map(([month, amount]) => ({
      Month: month,
      'Revenue Collected': amount
    }));
    return arrayToCSV(data);
  };

  const generateMaintenanceLog = () => {
    const allMaintenance = [
      ...maintenance.map(m => ({ ...m, type: 'maintenance' })),
      ...complaints.map(c => ({ ...c, type: 'complaint' }))
    ];

    const data = allMaintenance.map(item => ({
      Date: item.created || new Date(item.createdAt).toLocaleDateString(),
      Type: item.type,
      Tenant: item.tenantName,
      Category: item.category,
      Description: item.description,
      Priority: item.priority,
      Status: item.status
    }));
    return arrayToCSV(data);
  };

  const generateTenantAgingReport = () => {
    const data = tenants
      .filter(tenant => tenant.status !== 'paid')
      .map(tenant => {
        const lastPayment = payments
          .filter(p => p.tenantId === tenant.id && p.status === 'paid')
          .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())[0];

        const daysSinceLastPayment = lastPayment
          ? Math.floor((new Date().getTime() - new Date(lastPayment.paidAt).getTime()) / (1000 * 60 * 60 * 24))
          : 'Never';

        return {
          Tenant: tenant.name,
          Property: tenant.property,
          Unit: tenant.unit,
          'Monthly Rent': tenant.rent,
          Status: tenant.status,
          'Days Since Last Payment': daysSinceLastPayment,
          'Outstanding Amount': tenant.status === 'paid' ? 0 : tenant.rent
        };
      });
    return arrayToCSV(data);
  };

  const generateBankReconciliation = () => {
    const data = payments
      .filter(p => p.status === 'paid')
      .map(payment => ({
        Date: new Date(payment.paidAt).toLocaleDateString(),
        Tenant: payment.tenantName,
        Amount: payment.amount,
        Method: payment.method,
        Reference: payment.reference || '',
        Period: payment.period
      }));
    return arrayToCSV(data);
  };

  // Check data availability for each report
  const collectionsData = generateCollectionsReport();
  const occupancyData = generateOccupancyReport();
  const revenueData = generateRevenueStatement();
  const maintenanceData = generateMaintenanceLog();
  const agingData = generateTenantAgingReport();
  const reconciliationData = generateBankReconciliation();

  const reports = [
    { icon: Receipt, name: "Collections Report", desc: "Monthly rent collections by property", color: "text-success bg-success/10", hasData: collectionsData.trim().length > 0 },
    { icon: Home, name: "Occupancy Report", desc: "Vacancy trends & turnover", color: "text-info bg-info/10", hasData: occupancyData.trim().length > 0 },
    { icon: TrendingUp, name: "Revenue Statement", desc: "P&L by property · year-to-date", color: "text-primary bg-primary/10", hasData: revenueData.trim().length > 0 },
    { icon: Wrench, name: "Maintenance Log", desc: "All tickets, costs & resolution times", color: "text-warning bg-warning/10", hasData: maintenanceData.trim().length > 0 },
    { icon: FileBarChart, name: "Tenant Aging Report", desc: "Days outstanding by tenant", color: "text-destructive bg-destructive/10", hasData: agingData.trim().length > 0 },
    { icon: Receipt, name: "Bank Reconciliation", desc: "M-Pesa & bank deposits matched", color: "text-accent-foreground bg-accent/20", hasData: reconciliationData.trim().length > 0 },
  ];

  const handlePreview = (reportName: string) => {
    setPreviewing(reportName);

    // Generate report data
    let csvContent = '';
    switch (reportName) {
      case 'Collections Report':
        csvContent = generateCollectionsReport();
        break;
      case 'Occupancy Report':
        csvContent = generateOccupancyReport();
        break;
      case 'Revenue Statement':
        csvContent = generateRevenueStatement();
        break;
      case 'Maintenance Log':
        csvContent = generateMaintenanceLog();
        break;
      case 'Tenant Aging Report':
        csvContent = generateTenantAgingReport();
        break;
      case 'Bank Reconciliation':
        csvContent = generateBankReconciliation();
        break;
      default:
        return;
    }

    // Parse CSV to display format
    const lines = csvContent.trim().split('\n');
    if (lines.length === 0) {
      toast({
        title: "No data available",
        description: "This report contains no data to preview",
        variant: "destructive",
      });
      setPreviewing(null);
      return;
    }

    const headers = lines[0].split(',');
    const rows = lines.slice(1).map(line => line.split(','));

    setTimeout(() => {
      setPreviewing(null);
      setPreviewData({ name: reportName, data: [headers, ...rows] });
    }, 1000);
  };

  const handleExport = (reportName: string) => {
    // Generate report data
    let csvContent = '';
    let filename = '';

    switch (reportName) {
      case 'Collections Report':
        csvContent = generateCollectionsReport();
        filename = 'collections-report.csv';
        break;
      case 'Occupancy Report':
        csvContent = generateOccupancyReport();
        filename = 'occupancy-report.csv';
        break;
      case 'Revenue Statement':
        csvContent = generateRevenueStatement();
        filename = 'revenue-statement.csv';
        break;
      case 'Maintenance Log':
        csvContent = generateMaintenanceLog();
        filename = 'maintenance-log.csv';
        break;
      case 'Tenant Aging Report':
        csvContent = generateTenantAgingReport();
        filename = 'tenant-aging-report.csv';
        break;
      case 'Bank Reconciliation':
        csvContent = generateBankReconciliation();
        filename = 'bank-reconciliation.csv';
        break;
      default:
        toast({
          title: "Export failed",
          description: "Unknown report type",
          variant: "destructive",
        });
        return;
    }

    if (!csvContent.trim()) {
      toast({
        title: "No data to export",
        description: "The report contains no data",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Export started",
      description: `${reportName} is being prepared for download`,
    });

    // Simulate processing time
    setTimeout(() => {
      try {
        downloadCSV(filename, csvContent);
        toast({
          title: "Export complete",
          description: `${reportName} downloaded successfully`,
        });
      } catch (error) {
        toast({
          title: "Export failed",
          description: "Failed to download the report",
          variant: "destructive",
        });
      }
    }, 1500);
  };

  return (
    <AppShell title="Reports" subtitle="Audit-ready exports for accounting & compliance">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {reports.map(r => (
          <Card key={r.name} className="p-5 shadow-card border-border/60 hover:shadow-card-lg transition-all group">
            <div className={`size-12 rounded-xl flex items-center justify-center mb-4 ${r.color}`}>
              <r.icon className="size-6"/>
            </div>
            <h3 className="font-bold mb-1">{r.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">{r.desc}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={previewing === r.name}
                onClick={() => handlePreview(r.name)}
              >
                {previewing === r.name ? "Generating..." : "Preview"}
              </Button>
            <Button
              size="sm"
              className="gradient-primary text-primary-foreground flex-1"
              disabled={!r.hasData}
              onClick={() => handleExport(r.name)}
            >
                <Download className="size-3.5"/> Export
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewData} onOpenChange={() => setPreviewData(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{previewData?.name} Preview</DialogTitle>
          </DialogHeader>
          {previewData && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-border text-sm">
                <thead>
                  <tr className="bg-muted">
                    {previewData.data[0].map((header, i) => (
                      <th key={i} className="border border-border px-3 py-2 text-left font-semibold">
                        {header.replace(/"/g, '')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.data.slice(1).map((row, i) => (
                    <tr key={i} className="hover:bg-muted/50">
                      {row.map((cell, j) => (
                        <td key={j} className="border border-border px-3 py-2">
                          {cell.replace(/"/g, '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewData.data.length <= 1 && (
                <p className="text-center text-muted-foreground py-8">
                  No data available for this report.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};
export default Reports;
