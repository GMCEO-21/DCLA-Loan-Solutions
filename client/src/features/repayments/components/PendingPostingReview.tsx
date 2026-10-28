import {
  Box, Chip, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography,
} from "@mui/material";
import { formatRecordedTimestamp } from "@utils/dateTime";
import {
  getRepaymentBorrowerName,
  getRepaymentReviewIssue,
  type RepaymentReviewEntry,
} from "../approvalReview";

const currency = (value: number | string) =>
  `₱${Number(value).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function PendingPostingReview({
  entries,
}: {
  entries: RepaymentReviewEntry[];
}) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ mt: 2, overflowX: "auto" }}>
      <Table size="small" aria-label="Pending postings for review" sx={{ minWidth: 1100 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ minWidth: 260, position: "sticky", left: 0, bgcolor: "background.default", zIndex: 2 }}>
              Borrower and posting
            </TableCell>
            <TableCell>Entry</TableCell>
            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>Posted amount</TableCell>
            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>Loan balance</TableCell>
            <TableCell align="right">Penalty</TableCell>
            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>Past-due interest</TableCell>
            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>Loan payment</TableCell>
            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>Savings used</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {entries.map((entry) => {
            const { repayment, preview } = entry;
            const reversal = repayment.operationType === "reversal";
            const issue = getRepaymentReviewIssue(entry);
            const allocation = !issue && !reversal ? preview?.allocation : null;
            return (
              <TableRow key={repayment.id}>
                <TableCell sx={{ verticalAlign: "top", maxWidth: 320, overflowWrap: "anywhere", position: "sticky", left: 0, bgcolor: "background.paper", zIndex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {getRepaymentBorrowerName(repayment)}
                  </Typography>
                  <Chip
                    label={`Loan: ${repayment.loan?.status ?? "Unavailable"}`}
                    size="small"
                    color={issue ? "warning" : "default"}
                    variant="outlined"
                    sx={{ my: 0.75 }}
                  />
                  <Typography variant="caption" component="div" color="text.secondary">
                    Posting ref: {repayment.id}
                  </Typography>
                  <Typography variant="caption" component="div" color="text.secondary">
                    Loan ref: {repayment.loan?.id ?? "Unavailable"}
                  </Typography>
                  <Typography variant="caption" component="div" color="text.secondary">
                    Posted: {formatRecordedTimestamp(repayment.createdAt)}
                  </Typography>
                  {repayment.notes && (
                    <Typography variant="caption" component="div">Notes: {repayment.notes}</Typography>
                  )}
                  {issue && (
                    <Box sx={{ mt: 1, color: "warning.dark" }}>
                      <Typography variant="body2">Needs review: {issue}</Typography>
                    </Box>
                  )}
                </TableCell>
                <TableCell sx={{ verticalAlign: "top" }}>
                  {reversal ? "Reversal" : "Payment"}
                </TableCell>
                <TableCell align="right" sx={{ verticalAlign: "top", whiteSpace: "nowrap", fontWeight: 700 }}>
                  {currency(repayment.amount)}
                </TableCell>
                <TableCell align="right" sx={{ verticalAlign: "top", whiteSpace: "nowrap" }}>
                  {repayment.loan?.balance == null ? "Unavailable" : currency(repayment.loan.balance)}
                </TableCell>
                {[allocation?.penalty.amount, allocation?.pastDueInterest.amount,
                  allocation?.contractual.amount, allocation?.savingsUsed].map((amount, index) => (
                  <TableCell key={index} align="right" sx={{ verticalAlign: "top", whiteSpace: "nowrap" }}>
                    {amount == null ? "—" : currency(amount)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
