import * as XLSX from 'xlsx';

export function exportToExcel(data, filename, sheetName = 'Sheet1') {
  if (!data || data.length === 0) return;
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  // Auto column widths
  const colWidths = Object.keys(data[0]).map(key => ({
    wch: Math.max(key.length, ...data.map(row => String(row[key] ?? '').length), 10)
  }));
  ws['!cols'] = colWidths;
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
