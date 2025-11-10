import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Printer, Download, Eye } from 'lucide-react';
import { useState } from 'react';

interface QueryObject {
  sql: string;
  description: string;
  chartType: 'bar' | 'line' | 'pie' | 'table' | 'number';
  title: string;
  columns: string[];
}

interface AIChartProps {
  data: any[];
  query?: QueryObject;
  chartType?: 'bar' | 'line' | 'pie' | 'table' | 'number';
  title?: string;
  columns?: string[];
  hasBillData?: boolean;
  transactionIds?: number[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function AIChart({ data, query, chartType, title, columns, hasBillData, transactionIds }: AIChartProps) {
  // Extract properties from query object or use direct props
  const actualChartType = query?.chartType || chartType;
  const actualTitle = query?.title || title || 'Chart';
  const actualColumns = query?.columns || columns || [];
  const [showBillActions, setShowBillActions] = useState(false);

  const handlePrintBill = async (transactionId: number | string) => {
    try {
      // Validate transaction ID
      const validId = parseInt(String(transactionId));
      if (isNaN(validId) || validId <= 0) {
        console.error('Invalid transaction ID:', transactionId);
        return;
      }
      
      // Open the receipt in a new window for printing
      const printWindow = window.open(`/receipt/${validId}`, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    } catch (error) {
      console.error('Error printing bill:', error);
    }
  };

  const handleDownloadData = () => {
    if (!actualColumns) return;
    
    // Convert data to CSV
    const csv = [
      actualColumns.join(','),
      ...data.map(row => 
        actualColumns.map(col => 
          typeof row[col] === 'string' && row[col].includes(',') 
            ? `"${row[col]}"` 
            : row[col] || ''
        ).join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(actualTitle || 'report').replace(/[^a-zA-Z0-9]/g, '_')}_report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  if (!data || data.length === 0) {
    return null; // Hide the entire chart when no data
  }

  if (!actualChartType || !actualColumns || actualColumns.length === 0) {
    return null; // Hide the chart when configuration is invalid
  }

  const renderChart = () => {
    switch (actualChartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={actualColumns[0]} />
              <YAxis />
              <Tooltip formatter={(value: any) => typeof value === 'number' ? value.toFixed(2) : value} />
              <Legend />
              {actualColumns.slice(1).map((column, index) => (
                <Bar 
                  key={column} 
                  dataKey={column} 
                  fill={COLORS[index % COLORS.length]} 
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={actualColumns[0]} />
              <YAxis />
              <Tooltip formatter={(value: any) => typeof value === 'number' ? value.toFixed(2) : value} />
              <Legend />
              {actualColumns.slice(1).map((column, index) => (
                <Line 
                  key={column}
                  type="monotone" 
                  dataKey={column} 
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'pie':
        const pieData = data.map((item, index) => ({
          ...item,
          fill: COLORS[index % COLORS.length]
        }));
        
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey={actualColumns[1]}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => typeof value === 'number' ? value.toFixed(2) : value} />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'table':
        return (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b bg-slate-50">
                  {actualColumns.map((column) => (
                    <th key={column} className="p-3 text-left font-medium text-slate-700 capitalize">
                      {column.replace(/_/g, ' ')}
                    </th>
                  ))}
                  {hasBillData && <th className="p-3 text-left font-medium text-slate-700">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {data.map((row, index) => (
                  <tr key={index} className="border-b hover:bg-slate-50">
                    {actualColumns.map((column) => (
                      <td key={column} className="p-3 text-slate-600">
                        {typeof row[column] === 'number' ? row[column].toFixed(2) : row[column] || '-'}
                      </td>
                    ))}
                    {hasBillData && (
                      <td className="p-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePrintBill(row.transaction_id || row.id)}
                          className="flex items-center gap-2"
                        >
                          <Printer className="h-4 w-4" />
                          Print Bill
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case 'number':
        const value = data[0] && actualColumns[1] ? data[0][actualColumns[1]] : data.length;
        return (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="text-6xl font-bold text-blue-600 mb-2">
                {typeof value === 'number' ? value.toLocaleString() : value}
              </div>
              <div className="text-lg text-slate-600">
                {actualColumns[1] ? actualColumns[1].replace(/_/g, ' ').toUpperCase() : 'TOTAL RECORDS'}
              </div>
            </div>
          </div>
        );

      default:
        return <div>Unsupported chart type</div>;
    }
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-slate-800">{actualTitle}</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadData}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Download Data
          </Button>
          {hasBillData && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBillActions(!showBillActions)}
              className="flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              {showBillActions ? 'Hide' : 'Show'} Bill Actions
            </Button>
          )}
        </div>
      </div>
      
      {/* Always show chart visualization first */}
      {actualChartType !== 'table' && renderChart()}
      
      {/* Mandatory table view */}
      <div className="mt-6">
        <h4 className="text-md font-medium text-slate-700 mb-3">Detailed Data Table</h4>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b bg-slate-50">
                {(actualColumns || []).map((column) => (
                  <th key={column} className="p-3 text-left font-medium text-slate-700 capitalize">
                    {column.replace(/_/g, ' ')}
                  </th>
                ))}
                {hasBillData && showBillActions && <th className="p-3 text-left font-medium text-slate-700">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {data.map((row, index) => (
                <tr key={index} className="border-b hover:bg-slate-50">
                  {(actualColumns || []).map((column) => (
                    <td key={column} className="p-3 text-slate-600">
                      {typeof row[column] === 'number' ? row[column].toFixed(2) : row[column] || '-'}
                    </td>
                  ))}
                  {hasBillData && showBillActions && (
                    <td className="p-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Try multiple field names for transaction ID
                          const txId = row.transaction_id || row.id || row.transaction_number;
                          if (txId) {
                            handlePrintBill(txId);
                          } else {
                            console.error('No transaction ID found in row:', row);
                          }
                        }}
                        className="flex items-center gap-2"
                      >
                        <Printer className="h-4 w-4" />
                        Print Bill
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}