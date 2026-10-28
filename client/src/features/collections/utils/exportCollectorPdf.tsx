import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 16,
    textAlign: "left",
    fontSize: 8,
    color: "#0f172a",
  },
  header: {
    textAlign: "center",
    marginBottom: 10,
    fontSize: 14,
    fontWeight: "bold",
    color: "#1e3a8a",
  },
  subheader: {
    textAlign: "center",
    marginBottom: 12,
    fontSize: 10,
  },
  tableRow: {
    flexDirection: "row",
  },
  tableHeaderCell: {
    fontWeight: "bold",
    padding: 6,
    border: "0.75pt solid #cbd5f5",
    backgroundColor: "#e2e8f0",
  },
  tableCell: {
    padding: 6,
    border: "0.75pt solid #cbd5f5",
    fontSize: 8,
  },
  footer: {
    marginTop: 12,
    textAlign: "center",
    fontSize: 8,
    color: "#64748b",
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 6,
    borderTop: "0.75pt solid #cbd5f5",
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 6,
  },
  totalLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#0f172a",
  },
  totalValue: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#1e3a8a",
  },
});

const columnWidths = [
  "5%",
  "16%",
  "10%",
  "9%",
  "9%",
  "6%",
  "9%",
  "9%",
  "9%",
  "7%",
  "7%",
  "9%",
  "6%",
];

export interface CollectorRow {
  no: number;
  clientName: string;
  contact: string;
  loanAmount: string;
  overallAmount: string;
  termWeeks: string;
  amountDue: string;
  paymentReceived: string;
  netReleased: string;
  paymentsMade: string;
  savings: string;
  remainingBalance: string;
  status: string;
}

export async function exportCollectorPdf(params: {
  centerName: string;
  collectionDate: string;
  rows: CollectorRow[];
  totalAmountDue?: string;
}) {
  const { centerName, collectionDate, rows, totalAmountDue } = params;

  const tableHeader = [
    "No.",
    "Client Name",
    "Contact",
    "Loan Amount",
    "Overall Amount",
    "Term",
    "Amount Due",
    "Payment Received",
    "Net Released",
    "No. of Payment",
    "Savings",
    "Remaining Bal.",
    "Status",
  ];

  const doc = (
    <Document>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <Text style={styles.header}>Collector Report</Text>
        <Text style={styles.subheader}>
          {centerName} • Collection Date: {collectionDate}
        </Text>

        <View style={{ border: "0.75pt solid #cbd5f5", marginBottom: 8 }}>
          <View style={styles.tableRow}>
            {tableHeader.map((header, idx) => (
              <Text
                key={header}
                style={[
                  styles.tableHeaderCell,
                  { width: columnWidths[idx] },
                  { textAlign: "center" },
                ]}
              >
                {header}
              </Text>
            ))}
          </View>

          {rows.map((row, rowIndex) => (
            <View
              style={styles.tableRow}
              key={`${row.clientName}-${rowIndex}`}
            >
              {[
                row.no,
                row.clientName,
                row.contact,
                row.loanAmount || "",
                row.overallAmount || "",
                row.termWeeks,
                row.amountDue || "",
                "",
                "",
                row.paymentsMade,
                row.savings || "",
                row.remainingBalance || "",
                ""
              ].map((value, colIndex) => (
                <Text
                  key={`${rowIndex}-${colIndex}`}
                  style={[
                    styles.tableCell,
                    { width: columnWidths[colIndex] },
                    {
                      textAlign: "left",
                    },
                  ]}
                >
                  {value}
                </Text>
              ))}
            </View>
          ))}
        </View>

        {totalAmountDue ? (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount Due:</Text>
            <Text style={styles.totalValue}>{totalAmountDue}</Text>
          </View>
        ) : null}

        <Text style={styles.footer}>
          Prepared for collection monitoring • DCLA Loan Solutions
        </Text>
      </Page>
    </Document>
  );

  const blob = await pdf(doc).toBlob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `collector_report_${centerName
    .replace(/\s+/g, "_")
    .toLowerCase()}_${collectionDate.replace(/-/g, "_")}.pdf`;
  link.click();
}
