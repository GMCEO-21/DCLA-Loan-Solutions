import { Document, Page, View, Text, StyleSheet, pdf } from '@react-pdf/renderer';
import type { LoanRepaymentScheduleRow } from '@features/loans/types';

interface Member {
  firstName: string;
  lastName: string;
  middleName: string;
  contactNumber: string;
  centerLeader: string;
}

interface Loan {
  principalAmount: number | string;
  weeklyPaymentAmount: number | string;
  termWeek: number | string;
  createdAt: string | Date;
  savings: number | string;
  weeksPaid: number | string;
}

const styles = StyleSheet.create({
  page: { paddingTop: 18, paddingHorizontal: 28, paddingBottom: 18 },
  headerText: { fontSize: 14, fontWeight: 'bold', textAlign: 'center', marginBottom: 8, color: '#0f172a' },
  grid: { display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 6 },
  row: { display: 'flex', flexDirection: 'row' },
  cell: {
    border: '0.75pt solid #000',
    padding: 5,
    fontSize: 9,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  labelCell: {
    border: '0.75pt solid #000',
    padding: 5,
    fontSize: 9,
    fontWeight: 'bold',
    color: '#0f172a',
    backgroundColor: '#e2e8f0',
  },
  headerCell: {
    border: '0.75pt solid #000',
    padding: 5,
    fontSize: 9,
    fontWeight: 'bold',
    color: '#0f172a',
    backgroundColor: '#cbd5f5',
  },
  amountText: { color: '#19b414ff'},
  highlightText: { color: '#f01f22ff' },
  footer: { marginTop: 12, textAlign: 'center', fontSize: 8, fontWeight: 'bold', color: '#0f172a' },
  watermark: { position: 'absolute', opacity: 0.08 },
  watermarkText: {
    position: 'absolute',
    opacity: 0.08,
    fontSize: 100,
    fontWeight: 'bold',
    color: '#000',
    transform: 'rotate(45deg)',
  },
  passbook: { marginBottom: 10, padding: 6, border: '0pt solid transparent' },
  divider: { marginVertical: 4 },
});

export const generateLoanPassbookPDF = async (
  member: Member,
  loan: Loan,
  scheduleRows: LoanRepaymentScheduleRow[] = [],
  preview = false,
  collectionDay?: number | string // fallback: 0-6 (Sun-Sat) or day name like 'Friday'
): Promise<string | void> => {

  const principal = Number(loan.principalAmount);
  const weeklyPayment = Number(loan.weeklyPaymentAmount);
  const savings = Number(loan.savings);
  const termWeeks = Number(loan.termWeek);
  const releaseDate = new Date(loan.createdAt);

  const fullName = `${member.lastName.toUpperCase()}, ${member.firstName.toUpperCase()} ${
    member.middleName?.[0]?.toUpperCase() || ''
  }.`;

  const resolveWeekday = (day?: number | string): number | undefined => {
    if (day === undefined || day === null) return undefined;
    if (typeof day === 'number' && day >= 0 && day <= 6) return day;
    if (typeof day === 'string') {
      const map: Record<string, number> = {
        sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
      };
      const key = day.trim().toLowerCase();
      if (key in map) return map[key];
    }
    return undefined;
  };

  const targetWeekday = resolveWeekday(collectionDay);
  const epsilon = 0.01;
  const formatDueDate = (value: string | Date) =>
    new Date(value).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  const resolvedSchedule =
    scheduleRows.length > 0
      ? [...scheduleRows]
          .sort((a, b) => a.weekNumber - b.weekNumber)
          .map((row) => {
            const amountDue = Number(row.amountDue ?? weeklyPayment);
            const paidAmount =
              Number(row.amountPaid ?? 0) + Number(row.advanceApplied ?? 0);
            const paid =
              (row.status &&
                (row.status === 'paid' || row.status === 'advance')) ||
              paidAmount >= amountDue - epsilon;
            return {
              week: row.weekNumber,
              date: formatDueDate(row.dueDate),
              signature: '',
              amount: `P ${amountDue.toFixed(2)}`,
              paid,
            };
          })
      : Array.from({ length: termWeeks }, (_, i) => {
          const firstDueDate = new Date(releaseDate);
          if (typeof targetWeekday === 'number') {
            const current = releaseDate.getDay();
            let delta = (targetWeekday - current + 7) % 7;
            if (delta === 0) {
              delta = 7;
            }
            firstDueDate.setDate(releaseDate.getDate() + delta);
          } else {
            firstDueDate.setDate(releaseDate.getDate());
          }
          const dueDate = new Date(firstDueDate);
          dueDate.setDate(firstDueDate.getDate() + i * 7);
          return {
            week: i + 1,
            date: formatDueDate(dueDate),
            signature: '',
            amount: `P ${weeklyPayment.toFixed(2)}`,
            paid: false,
          };
        });

  const ScheduleRow = ({ s }: { s: typeof resolvedSchedule[number] }) => (
    <View style={{ display: 'flex', flexDirection: 'row' }}>
      <Text style={[styles.cell, { width: 35 }]}>{s.week.toString()}</Text>
      <Text style={[styles.cell, { flexGrow: 1, width: 150 }]}>{s.date}</Text>
      <Text style={[styles.cell, styles.highlightText, { width: 90 }]}>{s.amount}</Text>
      <Text style={[styles.cell, { width: 160 }]}>{s.signature}</Text>
      <Text style={[styles.cell, { width: 90 }]}>{s.paid ? 'PAID' : ''}</Text>
    </View>
  );

  const InfoRow = (props: { label1: string; value1: string; label2: string; value2: string }) => (
    <View style={styles.row}>
      <Text style={[styles.labelCell, { width: 120 }]}>{props.label1}</Text>
      <Text
        style={[
          styles.cell,
          { width: 200 },
          ...(props.label1.toLowerCase().includes('amount') ||
          props.label1.toLowerCase().includes('savings')
            ? [styles.amountText]
            : []),
        ]}
      >
        {props.value1}
      </Text>
      <Text style={[styles.labelCell, { width: 120 }]}>{props.label2}</Text>
      <Text
        style={[
          styles.cell,
          { width: 120 },
          ...(props.label2.toLowerCase().includes('amount') ||
          props.label2.toLowerCase().includes('savings')
            ? [styles.amountText]
            : []),
        ]}
      >
        {props.value2}
      </Text>
    </View>
  );

  const docElement = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={[styles.watermarkText, { left: 150, top: 100 }]} fixed>DCLA</Text>

        <Text style={styles.headerText}>DCLA LOAN SOLUTIONS</Text>

        <View style={styles.grid}>
          <InfoRow label1="Client Name" value1={fullName} label2="Loan Amount" value2={`P ${principal.toLocaleString()}`} />
          <InfoRow label1="Center Leader" value1={member.centerLeader} label2="Release Date" value2={releaseDate.toLocaleDateString('en-PH')} />
          <InfoRow label1="Contact Number" value1={member.contactNumber} label2="Savings" value2={`P ${savings.toFixed(2)}`} />
        </View>

        <View>
          <View style={styles.row}>
            <Text style={[styles.headerCell, { width: 35 }]}>#</Text>
            <Text style={[styles.headerCell, { flexGrow: 1, width: 150 }]}>Date</Text>
            <Text style={[styles.headerCell, { width: 90 }]}>Amount</Text>
            <Text style={[styles.headerCell, { width: 160 }]}>BM/AO Signature</Text>
            <Text style={[styles.headerCell, { width: 90 }]}>Remarks</Text>
          </View>
          {resolvedSchedule.map((s) => (
            <ScheduleRow key={s.week} s={s} />
          ))}
        </View>

        <Text style={styles.footer}>| Thank you for trusting DCLA Loan Solutions |</Text>
      </Page>
    </Document>
  );

  const blob = await pdf(docElement).toBlob();
  if (preview) {
    return URL.createObjectURL(blob);
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `loan_passbook_${member.lastName}.pdf`;
  link.click();
  return;
};
