import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  alpha,
  Box,
  Button,
  Chip,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import Autorenew from "@mui/icons-material/Autorenew";
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRight from "@mui/icons-material/KeyboardArrowRight";
import Payment from "@mui/icons-material/Payment";
import People from "@mui/icons-material/People";
import { useEffect, useState } from "react";
import type { MemberWithLoans } from "../types";

type MemberLoan = MemberWithLoans["loans"][number] & {
  principalAmount?: number;
  totalAmount?: number;
  weeklyPaymentAmount?: number;
  termWeeks?: number;
  balance?: number;
  status?: string;
};

type MemberWithLoansRow = Omit<MemberWithLoans, "loans"> & {
  loans: MemberLoan[];
  netCashReleasedForDate?: number;
  _forcePayoff?: boolean;
};

interface MembersTableProps {
  members: MemberWithLoansRow[];
  getStatusColor: (
    member: MemberWithLoansRow,
  ) => "default" | "success" | "warning" | "error";
  getStatusLabel: (member: MemberWithLoansRow) => string;
  getCollectionMetrics: (member: MemberWithLoansRow) => {
    received: number;
    due: number;
    weeklyDue?: number;
    weeksCovered?: number;
  };
  getPaymentInfo: (member: MemberWithLoansRow) => {
    weeklyDue: number;
    shortfall: number;
    totalPaid: number;
    weeksCovered: number;
  };
  formatCurrency: (amount: number) => string;
  onOpenPaymentDialog: (member: MemberWithLoansRow) => void;
  onOpenReloanDialog: (member: MemberWithLoansRow) => void;
  canReloan: boolean;
}

const detailCardSx = {
  p: 2,
  borderRadius: 2,
  backgroundColor: "background.paper",
  border: "1px solid",
  borderColor: "divider",
};

const detailLabelSx = {
  fontSize: "0.78rem",
  fontWeight: 700,
  letterSpacing: "0.04em",
  color: "text.secondary",
  textTransform: "uppercase",
  mb: 0.75,
};

const statusChipStyles: Record<string, { bg: string; color: string }> = {
  PAID: { bg: "#dcfce7", color: "#15803d" },
  PARTIAL: { bg: "#fef3c7", color: "#b45309" },
  UNPAID: { bg: "#fee2e2", color: "#dc2626" },
  PENDING: { bg: "#e0f2fe", color: "#0369a1" },
};

const loanConditionLabels = {
  past_due: "Past Due",
  past_maturity: "Past Maturity",
} as const;

const getActiveLoans = (member: MemberWithLoansRow): MemberLoan[] =>
  (member.loans ?? []).filter(
    (loan) => (loan.status || "").toLowerCase() === "active",
  );

const summaryDataGridColumns =
  "minmax(220px, 1fr) minmax(140px, 1fr) minmax(110px, 0.75fr) minmax(260px, 280px)";

const summaryGridColumns = `${summaryDataGridColumns} 24px`;

export function MembersTable({
  members,
  getStatusColor,
  getStatusLabel,
  getCollectionMetrics,
  getPaymentInfo,
  formatCurrency,
  onOpenPaymentDialog,
  onOpenReloanDialog,
  canReloan,
}: MembersTableProps) {
  const [expandedId, setExpandedId] = useState<string | false>(false);

  useEffect(() => {
    if (!members.length) {
      setExpandedId(false);
      return;
    }

    setExpandedId((current) =>
      current && members.some((member) => member.id === current)
        ? current
        : members[0].id,
    );
  }, [members]);

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography
        variant="h6"
        sx={{
          fontWeight: 600,
          color: "text.primary",
          mb: 3,
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <People color="primary" />
        Member Collection Status & Management
      </Typography>

      <Paper
        elevation={0}
        sx={{
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            display: { xs: "none", md: "grid" },
            gridTemplateColumns: summaryGridColumns,
            columnGap: 2,
            alignItems: "center",
            px: 3,
            py: 2.25,
            backgroundColor: "action.hover",
            borderBottom: "1px solid",
            borderColor: "divider",
            color: "text.secondary",
            fontWeight: 700,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            Client Name
          </Typography>
          <Typography
            variant="body2"
            sx={{ fontWeight: 700, justifySelf: "end", textAlign: "right" }}
          >
            Loan Amount
          </Typography>
          <Typography
            variant="body2"
            sx={{ fontWeight: 700, justifySelf: "center" }}
          >
            Status
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 700,
              justifySelf: "center",
              textAlign: "right",
            }}
          >
            Actions
          </Typography>
        </Box>

        {members.map((member, index) => {
          const activeLoans = getActiveLoans(member);
          const activeLoan =
            activeLoans.length === 1 ? activeLoans[0] : undefined;
          const { received, due } = getCollectionMetrics(member);
          const paymentInfo = getPaymentInfo(member);
          const weeksPaid = paymentInfo.weeksCovered ?? 0;
          const hasActive = activeLoans.length > 0;
          const hasSingleActiveLoan = activeLoans.length === 1;
          const principal = hasSingleActiveLoan
            ? Number(activeLoan?.principalAmount ?? 0)
            : Number(member.totalLoanAmount ?? 0);
          const totalAmount = hasSingleActiveLoan
            ? Number(activeLoan?.totalAmount ?? 0)
            : Number(member.overallAmount ?? 0);
          const termWeeks = hasSingleActiveLoan
            ? Number(activeLoan?.termWeeks ?? 0)
            : Number(member.totalTermWeeks ?? 0);
          const weekly =
            due ||
            Number(
              hasSingleActiveLoan
                ? (activeLoan?.weeklyPaymentAmount ??
                    member.weeklyPaymentAmount ??
                    0)
                : (member.weeklyPaymentAmount ?? 0),
            );
          const balance = hasSingleActiveLoan
            ? Number(activeLoan?.balance ?? 0)
            : Number(member.totalBalance ?? 0);
          const canPostPayment = hasSingleActiveLoan && balance > 0;
          const paymentTooltip =
            activeLoans.length > 1
              ? "Multiple active loans found. Resolve loan records before posting payment."
              : "Process Payment";
          const statusLabel = getStatusLabel(member);
          const paymentColor =
            due > 0
              ? received >= due
                ? "#10b981"
                : received > 0
                  ? "#f59e0b"
                  : "#64748b"
              : received > 0
                ? "#f59e0b"
                : "#64748b";
          const summaryStatusStyle =
            statusChipStyles[statusLabel] ?? statusChipStyles.UNPAID;
          const isExpanded = expandedId === member.id;

          return (
            <Accordion
              key={member.id}
              expanded={isExpanded}
              onChange={(_, expanded) =>
                setExpandedId(expanded ? member.id : false)
              }
              disableGutters
              elevation={0}
              sx={{
                backgroundColor: "background.paper",
                "&:before": { display: "none" },
                borderBottom:
                  index === members.length - 1 ? "none" : "1px solid",
                borderColor: "divider",
              }}
            >
              <AccordionSummary
                expandIcon={
                  isExpanded ? (
                    <KeyboardArrowDown color="action" />
                  ) : (
                    <KeyboardArrowRight color="action" />
                  )
                }
                sx={{
                  display: { xs: "flex", md: "grid" },
                  gridTemplateColumns: { md: summaryGridColumns },
                  columnGap: { md: 2 },
                  alignItems: { md: "center" },
                  px: 3,
                  py: 1.5,
                  minHeight: 88,
                  "& .MuiAccordionSummary-content": {
                    m: 0,
                    minWidth: 0,
                    flexGrow: { md: 0 },
                    gridColumn: { md: "1 / 5" },
                    width: { md: "100%" },
                  },
                  "& .MuiAccordionSummary-expandIconWrapper": {
                    gridColumn: { md: 5 },
                    justifySelf: { md: "end" },
                    alignSelf: { md: "center" },
                  },
                  "&:hover": {
                    backgroundColor: alpha("#3b82f6", 0.03),
                  },
                }}
              >
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: summaryDataGridColumns,
                    },
                    gap: { xs: 1.5, md: 2 },
                    alignItems: "center",
                    width: "100%",
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.75,
                        flexWrap: "wrap",
                      }}
                    >
                      <Typography
                        variant="body1"
                        sx={{ fontWeight: 700, color: "text.primary" }}
                      >
                        {member.firstName} {member.lastName}
                      </Typography>
                      {(member.loanCondition?.status === "past_due" ||
                        member.loanCondition?.status === "past_maturity") && (
                        <Chip
                          label={
                            loanConditionLabels[member.loanCondition.status]
                          }
                          size="small"
                          variant="outlined"
                          sx={{
                            height: 22,
                            borderColor: "warning.main",
                            backgroundColor: (muiTheme) =>
                              alpha(muiTheme.palette.warning.main, 0.08),
                            color: "warning.dark",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            "& .MuiChip-label": { px: 0.875 },
                          }}
                        />
                      )}
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {member.contactNumber}
                    </Typography>
                  </Box>

                  <Box sx={{ textAlign: { xs: "left", md: "right" } }}>
                    <Typography
                      variant="caption"
                      sx={{
                        display: { xs: "block", md: "none" },
                        color: "#64748b",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        mb: 0.5,
                      }}
                    >
                      Loan Amount
                    </Typography>
                    <Typography
                      variant="body1"
                      sx={{ fontWeight: 700, color: "#2563eb" }}
                    >
                      {formatCurrency(hasActive ? principal : 0)}
                    </Typography>
                  </Box>

                  <Box sx={{ textAlign: { xs: "left", md: "center" } }}>
                    <Typography
                      variant="caption"
                      sx={{
                        display: { xs: "block", md: "none" },
                        color: "#64748b",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        mb: 0.5,
                      }}
                    >
                      Status
                    </Typography>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: { xs: "flex-start", md: "center" },
                      }}
                    >
                      <Chip
                        label={statusLabel}
                        color={getStatusColor(member)}
                        size="small"
                        sx={{
                          minWidth: 86,
                          fontWeight: 700,
                          backgroundColor: summaryStatusStyle.bg,
                          color: summaryStatusStyle.color,
                          "& .MuiChip-label": {
                            px: 1.5,
                          },
                        }}
                      />
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: { xs: "flex-start", md: "flex-end" },
                      alignItems: "center",
                      gap: 1,
                      flexWrap: "nowrap",
                      whiteSpace: "nowrap",
                    }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Tooltip title={paymentTooltip}>
                      <span>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<Payment />}
                          onClick={() => onOpenPaymentDialog(member)}
                          disabled={!canPostPayment}
                          sx={{
                            minWidth: 98,
                            minHeight: 44,
                            borderRadius: 2,
                            fontWeight: 700,
                            borderColor: "#bfdbfe",
                            color: "#2563eb",
                            "&:hover": {
                              borderColor: "#93c5fd",
                              backgroundColor: alpha("#3b82f6", 0.08),
                            },
                          }}
                        >
                          Payment
                        </Button>
                      </span>
                    </Tooltip>
                    {canReloan && (
                      <Tooltip title="Process Reloan">
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<Autorenew />}
                          onClick={() =>
                            onOpenReloanDialog({
                              ...member,
                              _forcePayoff: !hasActive || balance <= 0,
                            })
                          }
                          sx={{
                            minWidth: 98,
                            minHeight: 44,
                            borderRadius: 2,
                            fontWeight: 700,
                            borderColor: "#bfdbfe",
                            color: "#2563eb",
                            "&:hover": {
                              borderColor: "#93c5fd",
                              backgroundColor: alpha("#3b82f6", 0.08),
                            },
                          }}
                        >
                          Reloan
                        </Button>
                      </Tooltip>
                    )}
                  </Box>
                </Box>
              </AccordionSummary>

              <AccordionDetails
                sx={{
                  px: 3,
                  pb: 3,
                  pt: 0.5,
                  borderTop: "1px solid",
                  borderColor: "divider",
                  backgroundColor: "action.hover",
                }}
              >
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "repeat(2, minmax(0, 1fr))",
                      lg: "repeat(4, minmax(0, 1fr))",
                    },
                    gap: 2,
                  }}
                >
                  <Box sx={detailCardSx}>
                    <Typography sx={detailLabelSx}>Overall Amount</Typography>
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 700, color: "#8b5cf6" }}
                    >
                      {formatCurrency(hasActive ? totalAmount : 0)}
                    </Typography>
                  </Box>

                  <Box sx={detailCardSx}>
                    <Typography sx={detailLabelSx}>Term Weeks</Typography>
                    <Chip
                      label={`${termWeeks}w`}
                      size="small"
                      sx={{
                        backgroundColor: "#dbeafe",
                        color: "#1d4ed8",
                        fontWeight: 700,
                      }}
                    />
                  </Box>

                  <Box sx={detailCardSx}>
                    <Typography sx={detailLabelSx}>Weekly Payment</Typography>
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 700, color: "#059669" }}
                    >
                      {formatCurrency(hasActive ? weekly : 0)}
                    </Typography>
                  </Box>

                  <Box sx={detailCardSx}>
                    <Typography sx={detailLabelSx}>Payment Received</Typography>
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 700, color: paymentColor }}
                    >
                      {formatCurrency(received)}
                    </Typography>
                  </Box>

                  <Box sx={detailCardSx}>
                    <Typography sx={detailLabelSx}>
                      Net Cash Released
                    </Typography>
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 700, color: "#3b82f6" }}
                    >
                      {formatCurrency(
                        Number(
                          member.netCashReleasedForDate ??
                            member.netCashReleased ??
                            0,
                        ),
                      )}
                    </Typography>
                  </Box>

                  <Box sx={detailCardSx}>
                    <Typography sx={detailLabelSx}>Payments Made</Typography>
                    <Chip
                      label={weeksPaid}
                      size="small"
                      sx={{
                        backgroundColor: "#f3e8ff",
                        color: "#7c3aed",
                        fontWeight: 700,
                      }}
                    />
                  </Box>

                  <Box sx={detailCardSx}>
                    <Typography sx={detailLabelSx}>Savings</Typography>
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 700, color: "#f59e0b" }}
                    >
                      {formatCurrency(Number(member.totalSavings || 0))}
                    </Typography>
                  </Box>

                  <Box sx={detailCardSx}>
                    <Typography sx={detailLabelSx}>
                      Remaining Balance
                    </Typography>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 700,
                        color: balance > 0 ? "#ef4444" : "#10b981",
                      }}
                    >
                      {formatCurrency(hasActive ? balance : 0)}
                    </Typography>
                  </Box>
                </Box>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Paper>
    </Box>
  );
}
