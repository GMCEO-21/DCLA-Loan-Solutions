import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import type { PortfolioSummary, ProjectedIncomeSummary } from '../types';

export async function exportPortfolioToExcel(portfolioData: PortfolioSummary): Promise<void> {
  try {
    // Try ExcelJS first for better styling
    await exportWithExcelJS(portfolioData);
  } catch (error) {
    console.error('ExcelJS export failed, falling back to XLSX:', error);
    // Fallback to XLSX
    exportWithXLSX(portfolioData);
  }
}

async function exportWithExcelJS(portfolioData: PortfolioSummary): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('PORTFOLIO');

  // Set column widths
  worksheet.columns = [
    { width: 8 },   // No.
    { width: 25 },  // Center Name
    { width: 20 },  // Amount Disbursed
    { width: 25 },  // Outstanding Collection
  ];

  // Title
  const titleRow = worksheet.addRow(['PORTFOLIO']);
  titleRow.height = 30;
  titleRow.getCell(1).font = { size: 18, bold: true, color: { argb: 'FF1e3a8a' } };
  titleRow.getCell(1).alignment = { horizontal: 'center' };
  worksheet.mergeCells('A1:D1');

  // Empty row
  worksheet.addRow([]);

  // Date row
  const dateRow = worksheet.addRow([`Generated on: ${new Date().toLocaleDateString()}`]);
  dateRow.getCell(1).font = { size: 12, italic: true };
  dateRow.getCell(1).alignment = { horizontal: 'center' };
  worksheet.mergeCells('A3:D3');

  // Empty rows
  worksheet.addRow([]);
  worksheet.addRow([]);

  // Headers
  const headerRow = worksheet.addRow(['No.', 'Center Name', 'Amount Disbursed', 'Outstanding Collection']);
  headerRow.height = 25;
  
  // Style headers
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1e3a8a' }
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    
    // Suppress unused parameter warning
    void colNumber;
  });

  // Data rows
  portfolioData.centers.forEach((center) => {
    const row = worksheet.addRow([
      center.no,
      center.centerName,
      center.amountDisbursed,
      center.outstandingCollection
    ]);

    // Style data rows
    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } }
      };

      if (colNumber === 1) {
        // No. column
        cell.alignment = { horizontal: 'center' };
        cell.font = { bold: true };
      } else if (colNumber === 2) {
        // Center Name column
        cell.alignment = { horizontal: 'left' };
        cell.font = { bold: true };
      } else if (colNumber === 3) {
        // Amount Disbursed column
        cell.alignment = { horizontal: 'right' };
        cell.numFmt = '#,##0.00';
        cell.font = { color: { argb: 'FF10b981' } };
      } else if (colNumber === 4) {
        // Outstanding Collection column
        cell.alignment = { horizontal: 'right' };
        cell.numFmt = '#,##0.00';
        const amount = center.outstandingCollection;
        if (amount > 0) {
          cell.font = { bold: true, color: { argb: 'FFf59e0b' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFF3CD' } // Light yellow background
          };
        } else {
          cell.font = { color: { argb: 'FF10b981' } };
        }
      }
    });
  });

  // Total row
  const totalRow = worksheet.addRow([
    'Total',
    'Total',
    portfolioData.totalAmountDisbursed,
    portfolioData.totalOutstandingCollection
  ]);

  // Style total row
  totalRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF374151' }
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } }
    };

    if (colNumber === 1 || colNumber === 2) {
      cell.alignment = { horizontal: 'center' };
    } else {
      cell.alignment = { horizontal: 'right' };
      cell.numFmt = '#,##0.00';
    }

    // Highlight total outstanding collection
    if (colNumber === 4) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF3CD' } // Light yellow background
      };
      cell.font = { bold: true, color: { argb: 'FF000000' } };
    }
  });

  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Portfolio_${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

function exportWithXLSX(portfolioData: PortfolioSummary): void {
  // Prepare data for XLSX
  const exportData = [
    ['PORTFOLIO'],
    [`Generated on: ${new Date().toLocaleDateString()}`],
    [],
    ['No.', 'Center Name', 'Amount Disbursed', 'Outstanding Collection'],
    ...portfolioData.centers.map(center => [
      center.no,
      center.centerName,
      center.amountDisbursed,
      center.outstandingCollection
    ]),
    ['Total', 'Total', portfolioData.totalAmountDisbursed, portfolioData.totalOutstandingCollection]
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'PORTFOLIO');

  // Generate and download
  XLSX.writeFile(workbook, `Portfolio_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export async function exportProjectedIncomeToExcel(projectedIncomeData: ProjectedIncomeSummary): Promise<void> {
  try {
    // Try ExcelJS first for better styling
    await exportProjectedIncomeWithExcelJS(projectedIncomeData);
  } catch (error) {
    console.error('ExcelJS export failed, falling back to XLSX:', error);
    // Fallback to XLSX
    exportProjectedIncomeWithXLSX(projectedIncomeData);
  }
}

async function exportProjectedIncomeWithExcelJS(projectedIncomeData: ProjectedIncomeSummary): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('PROJECTED INCOME');

  // Set column widths
  worksheet.columns = [
    { width: 8 },   // No.
    { width: 25 },  // Center Name
    { width: 20 },  // Outstanding Bal.
    { width: 20 },  // Interest Income
  ];

  // Title
  const titleRow = worksheet.addRow(['PROJECTED INCOME']);
  titleRow.height = 30;
  titleRow.getCell(1).font = { size: 18, bold: true, color: { argb: 'FF1e3a8a' } };
  titleRow.getCell(1).alignment = { horizontal: 'center' };
  worksheet.mergeCells('A1:D1');

  // Empty row
  worksheet.addRow([]);

  // Date row
  const dateRow = worksheet.addRow([`Generated on: ${new Date().toLocaleDateString()}`]);
  dateRow.getCell(1).font = { size: 12, italic: true };
  dateRow.getCell(1).alignment = { horizontal: 'center' };
  worksheet.mergeCells('A3:D3');

  // Empty rows
  worksheet.addRow([]);
  worksheet.addRow([]);

  // Headers
  const headerRow = worksheet.addRow(['No.', 'Center Name', 'Outstanding Bal.', 'Interest Income']);
  headerRow.height = 25;
  
  // Style headers
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1e3a8a' }
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    
    // Suppress unused parameter warning
    void colNumber;
  });

  // Data rows
  projectedIncomeData.centers.forEach((center) => {
    const row = worksheet.addRow([
      center.no,
      center.centerName,
      center.outstandingBalance,
      center.interestIncome
    ]);

    // Style data rows
    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } }
      };

      if (colNumber === 1) {
        // No. column
        cell.alignment = { horizontal: 'center' };
        cell.font = { bold: true };
      } else if (colNumber === 2) {
        // Center Name column
        cell.alignment = { horizontal: 'left' };
        cell.font = { bold: true };
      } else if (colNumber === 3) {
        // Outstanding Balance column
        cell.alignment = { horizontal: 'right' };
        cell.numFmt = '#,##0.00';
        cell.font = { color: { argb: 'FFf59e0b' } };
      } else if (colNumber === 4) {
        // Interest Income column
        cell.alignment = { horizontal: 'right' };
        cell.numFmt = '#,##0.00';
        const amount = center.interestIncome;
        if (amount > 0) {
          cell.font = { bold: true, color: { argb: 'FF000000' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFF3CD' } // Light yellow background
          };
        } else {
          cell.font = { color: { argb: 'FF10b981' } };
        }
      }
    });
  });

  // Total row
  const totalRow = worksheet.addRow([
    'Total',
    'Total',
    projectedIncomeData.totalOutstandingBalance,
    projectedIncomeData.totalInterestIncome
  ]);

  // Style total row
  totalRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF374151' }
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } }
    };

    if (colNumber === 1 || colNumber === 2) {
      cell.alignment = { horizontal: 'center' };
    } else {
      cell.alignment = { horizontal: 'right' };
      cell.numFmt = '#,##0.00';
    }

    // Highlight total interest income
    if (colNumber === 4) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF3CD' } // Light yellow background
      };
      cell.font = { bold: true, color: { argb: 'FF000000' } };
    }
  });

  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Projected_Income_${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

function exportProjectedIncomeWithXLSX(projectedIncomeData: ProjectedIncomeSummary): void {
  // Prepare data for XLSX
  const exportData = [
    ['PROJECTED INCOME'],
    [`Generated on: ${new Date().toLocaleDateString()}`],
    [],
    ['No.', 'Center Name', 'Outstanding Bal.', 'Interest Income'],
    ...projectedIncomeData.centers.map(center => [
      center.no,
      center.centerName,
      center.outstandingBalance,
      center.interestIncome
    ]),
    ['Total', 'Total', projectedIncomeData.totalOutstandingBalance, projectedIncomeData.totalInterestIncome]
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'PROJECTED INCOME');

  // Generate and download
  XLSX.writeFile(workbook, `Projected_Income_${new Date().toISOString().split('T')[0]}.xlsx`);
}
