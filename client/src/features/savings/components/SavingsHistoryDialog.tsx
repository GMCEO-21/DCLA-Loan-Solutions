import { Fragment, useEffect, useState } from "react";
import axios from "axios";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import ChevronLeft from "@mui/icons-material/ChevronLeft";
import ChevronRight from "@mui/icons-material/ChevronRight";
import Close from "@mui/icons-material/Close";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import History from "@mui/icons-material/History";
import { useSavingsHistory } from "../hooks/useSavingsHistory";
import {
  formatSavingsBusinessDate,
  formatSavingsMoney,
  SAVINGS_EVENT_LABELS,
} from "../savings-history";
import { formatRecordedTimestamp } from "@utils/dateTime";
import type {
  SavingsHistoryPagination,
  SavingsHistoryScope,
  SavingsLedgerHistoryItem,
  SavingsLegacyHistoryItem,
} from "../types";

const PAGE_LIMIT = 25;

interface MemberLite {
  id: string;
  firstName: string;
  lastName: string;
}

interface SavingsHistoryDialogProps {
  open: boolean;
  member: MemberLite | null;
  currentSavings: number;
  formatCurrency: (amount: number) => string;
  onClose: () => void;
}

function getHistoryErrorMessage(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return "Unable to load savings history. Please try again.";
  }

  switch (error.response?.status) {
    case 400:
      return "The savings history request was invalid. Please try again.";
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You do not have permission to view this savings history.";
    case 404:
      return "This member's savings history could not be found.";
    default:
      return "Unable to load savings history. Please check your connection and try again.";
  }
}

function HistoryPager({
  pagination,
  onPageChange,
}: {
  pagination: SavingsHistoryPagination;
  onPageChange: (page: number) => void;
}) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="center"
      spacing={1.5}
      sx={{ py: 2, px: 1 }}
      aria-label="Savings history pagination"
    >
      <Button
        variant="outlined"
        size="small"
        startIcon={<ChevronLeft />}
        disabled={pagination.page <= 1}
        onClick={() => onPageChange(pagination.page - 1)}
      >
        Previous
      </Button>
      <Typography variant="body2" color="text.secondary" aria-live="polite">
        Page {pagination.page} of {pagination.totalPages}
      </Typography>
      <Button
        variant="outlined"
        size="small"
        endIcon={<ChevronRight />}
        disabled={pagination.page >= pagination.totalPages}
        onClick={() => onPageChange(pagination.page + 1)}
      >
        Next
      </Button>
    </Stack>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
        {value}
      </Typography>
    </Box>
  );
}

function LedgerDetails({ item }: { item: SavingsLedgerHistoryItem }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
        gap: 1.5,
        p: 2,
        bgcolor: "background.default",
      }}
    >
      <DetailField
        label="Balance Before"
        value={formatSavingsMoney(item.balanceBefore)}
      />
      <DetailField
        label="Recorded At"
        value={formatRecordedTimestamp(item.createdAt)}
      />
      <DetailField
        label="Performed By"
        value={item.performedBy?.name || "System"}
      />
      <DetailField label="Remarks" value={item.remarks || "—"} />
      {item.referenceType && (
        <DetailField label="Reference" value={item.referenceType} />
      )}
      {item.reversalOfId && (
        <DetailField
          label="Reversal Link"
          value="Linked to original transaction"
        />
      )}
    </Box>
  );
}

function LedgerTable({ items }: { items: SavingsLedgerHistoryItem[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <TableContainer>
      <Table size="small" aria-label="Savings ledger transactions">
        <TableHead>
          <TableRow sx={{ bgcolor: "background.default" }}>
            <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Transaction</TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>
              Amount
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>
              Balance After
            </TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Performed By</TableCell>
            <TableCell align="center" sx={{ fontWeight: 700 }}>
              Details
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => {
            const expanded = expandedId === item.id;
            return (
              <Fragment key={item.id}>
                <TableRow hover>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {formatSavingsBusinessDate(item.businessDate)}
                  </TableCell>
                  <TableCell>{SAVINGS_EVENT_LABELS[item.eventType]}</TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      whiteSpace: "nowrap",
                      fontWeight: 700,
                      color: item.amount.startsWith("-")
                        ? "error.dark"
                        : "success.dark",
                    }}
                  >
                    {formatSavingsMoney(item.amount, true)}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ whiteSpace: "nowrap", fontWeight: 600 }}
                  >
                    {formatSavingsMoney(item.balanceAfter)}
                  </TableCell>
                  <TableCell>{item.performedBy?.name || "System"}</TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      aria-label={`${expanded ? "Hide" : "Show"} details for ${SAVINGS_EVENT_LABELS[item.eventType]}`}
                      aria-expanded={expanded}
                      onClick={() => setExpandedId(expanded ? null : item.id)}
                    >
                      {expanded ? <ExpandLess /> : <ExpandMore />}
                    </IconButton>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell
                    colSpan={6}
                    sx={{ p: 0, borderBottom: expanded ? undefined : 0 }}
                  >
                    <Collapse in={expanded} timeout="auto" unmountOnExit>
                      <LedgerDetails item={item} />
                    </Collapse>
                  </TableCell>
                </TableRow>
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function LedgerCards({ items }: { items: SavingsLedgerHistoryItem[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Stack spacing={1.5} sx={{ p: 1.5 }}>
      {items.map((item) => {
        const expanded = expandedId === item.id;
        return (
          <Paper
            key={item.id}
            variant="outlined"
            sx={{ borderRadius: 1, overflow: "hidden" }}
          >
            <Button
              color="inherit"
              fullWidth
              onClick={() => setExpandedId(expanded ? null : item.id)}
              aria-expanded={expanded}
              aria-label={`${expanded ? "Hide" : "Show"} details for ${SAVINGS_EVENT_LABELS[item.eventType]}`}
              endIcon={expanded ? <ExpandLess /> : <ExpandMore />}
              sx={{
                justifyContent: "space-between",
                p: 1.5,
                textAlign: "left",
              }}
            >
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Stack direction="row" justifyContent="space-between" gap={1}>
                  <Typography variant="body2" fontWeight={700}>
                    {SAVINGS_EVENT_LABELS[item.eventType]}
                  </Typography>
                  <Typography
                    variant="body2"
                    fontWeight={800}
                    color={
                      item.amount.startsWith("-")
                        ? "error.dark"
                        : "success.dark"
                    }
                    sx={{ whiteSpace: "nowrap" }}
                  >
                    {formatSavingsMoney(item.amount, true)}
                  </Typography>
                </Stack>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  gap={1}
                  mt={0.75}
                >
                  <Typography variant="caption" color="text.secondary">
                    {formatSavingsBusinessDate(item.businessDate)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Balance {formatSavingsMoney(item.balanceAfter)}
                  </Typography>
                </Stack>
              </Box>
            </Button>
            <Collapse in={expanded} timeout="auto" unmountOnExit>
              <Divider />
              <LedgerDetails item={item} />
            </Collapse>
          </Paper>
        );
      })}
    </Stack>
  );
}

function LegacyTable({ items }: { items: SavingsLegacyHistoryItem[] }) {
  return (
    <TableContainer>
      <Table size="small" aria-label="Legacy savings transactions">
        <TableHead>
          <TableRow sx={{ bgcolor: "background.default" }}>
            <TableCell sx={{ fontWeight: 700 }}>Recorded At</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Direction</TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>
              Amount
            </TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Remarks</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} hover>
              <TableCell sx={{ whiteSpace: "nowrap" }}>
                {formatRecordedTimestamp(item.createdAt)}
              </TableCell>
              <TableCell>
                {item.direction
                  ? item.direction[0].toUpperCase() + item.direction.slice(1)
                  : "—"}
              </TableCell>
              <TableCell
                align="right"
                sx={{ whiteSpace: "nowrap", fontWeight: 700 }}
              >
                {formatSavingsMoney(item.amount, item.direction === "credit")}
              </TableCell>
              <TableCell>{item.remarks || "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function LegacyCards({ items }: { items: SavingsLegacyHistoryItem[] }) {
  return (
    <Stack spacing={1.5} sx={{ p: 1.5 }}>
      {items.map((item) => (
        <Paper
          key={item.id}
          variant="outlined"
          sx={{ borderRadius: 1, p: 1.5 }}
        >
          <Stack direction="row" justifyContent="space-between" gap={1}>
            <Chip
              size="small"
              variant="outlined"
              label={
                item.direction
                  ? item.direction[0].toUpperCase() + item.direction.slice(1)
                  : "—"
              }
            />
            <Typography
              variant="body2"
              fontWeight={800}
              sx={{ whiteSpace: "nowrap" }}
            >
              {formatSavingsMoney(item.amount, item.direction === "credit")}
            </Typography>
          </Stack>
          <Typography variant="body2" mt={1}>
            {formatRecordedTimestamp(item.createdAt)}
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            {item.remarks || "—"}
          </Typography>
        </Paper>
      ))}
    </Stack>
  );
}

function ActiveHistoryPanel({
  memberId,
  scope,
  page,
  compact,
  enabled,
  onPageChange,
}: {
  memberId: string;
  scope: SavingsHistoryScope;
  page: number;
  compact: boolean;
  enabled: boolean;
  onPageChange: (page: number) => void;
}) {
  const query = useSavingsHistory(memberId, scope, page, PAGE_LIMIT, enabled);
  const data = query.data;

  return (
    <>
      {query.isFetching && data && (
        <LinearProgress aria-label="Refreshing savings history" />
      )}

      {query.isLoading && !data && (
        <Stack
          alignItems="center"
          justifyContent="center"
          spacing={1.5}
          sx={{ flex: 1, py: 8 }}
        >
          <CircularProgress size={32} />
          <Typography variant="body2" color="text.secondary">
            Loading savings history...
          </Typography>
        </Stack>
      )}

      {query.isError && !data && (
        <Box sx={{ px: { xs: 2, sm: 3 }, py: 3 }}>
          <Alert
            severity="error"
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => query.refetch()}
              >
                Retry
              </Button>
            }
          >
            {getHistoryErrorMessage(query.error)}
          </Alert>
        </Box>
      )}

      {data && data.items.length === 0 && (
        <Stack
          alignItems="center"
          justifyContent="center"
          sx={{ flex: 1, py: 8, px: 2 }}
        >
          <History sx={{ color: "text.disabled", fontSize: 42, mb: 1 }} />
          <Typography color="text.secondary" textAlign="center">
            {scope === "ledger"
              ? "No savings ledger transactions yet."
              : "No legacy savings transactions."}
          </Typography>
        </Stack>
      )}

      {data?.scope === "ledger" && data.items.length > 0 && (
        <Box
          sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}
          data-testid={compact ? "ledger-mobile" : "ledger-desktop"}
        >
          {compact ? (
            <LedgerCards items={data.items} />
          ) : (
            <LedgerTable items={data.items} />
          )}
        </Box>
      )}

      {data?.scope === "legacy" && data.items.length > 0 && (
        <Box
          sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}
          data-testid={compact ? "legacy-mobile" : "legacy-desktop"}
        >
          {compact ? (
            <LegacyCards items={data.items} />
          ) : (
            <LegacyTable items={data.items} />
          )}
        </Box>
      )}

      {data && (
        <Box sx={{ borderTop: 1, borderColor: "divider", flexShrink: 0 }}>
          <HistoryPager
            pagination={data.pagination}
            onPageChange={onPageChange}
          />
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            textAlign="center"
            sx={{ mt: -1.5, pb: 1.5 }}
          >
            {data.pagination.total} transaction
            {data.pagination.total === 1 ? "" : "s"}
          </Typography>
        </Box>
      )}
    </>
  );
}

export default function SavingsHistoryDialog({
  open,
  member,
  currentSavings,
  formatCurrency,
  onClose,
}: SavingsHistoryDialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const compact = useMediaQuery(theme.breakpoints.down("md"));
  const [scope, setScope] = useState<SavingsHistoryScope>("ledger");
  const [ledgerPage, setLedgerPage] = useState(1);
  const [legacyPage, setLegacyPage] = useState(1);
  const memberId = member?.id ?? "";

  useEffect(() => {
    setScope("ledger");
    setLedgerPage(1);
    setLegacyPage(1);
  }, [memberId]);

  const page = scope === "ledger" ? ledgerPage : legacyPage;
  const setPage = scope === "ledger" ? setLedgerPage : setLegacyPage;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      fullScreen={fullScreen}
      aria-labelledby="savings-history-title"
      PaperProps={{
        sx: {
          width: { sm: "calc(100% - 32px)" },
          maxWidth: { sm: 1050 },
          height: { xs: "100%", sm: "min(90vh, 820px)" },
          maxHeight: { xs: "100%", sm: "90vh" },
          borderRadius: { xs: 0, sm: 2 },
          overflow: "hidden",
        },
      }}
    >
      <Box
        component="div"
        sx={{
          bgcolor: "primary.main",
          color: "primary.contrastText",
          px: { xs: 2, sm: 3 },
          py: 2,
        }}
      >
        <Stack
          direction="row"
          alignItems="flex-start"
          justifyContent="space-between"
          gap={2}
        >
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <History aria-hidden="true" />
              <Typography
                id="savings-history-title"
                component="h2"
                variant="h6"
                fontWeight={800}
              >
                Savings History
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ opacity: 0.86, mt: 0.5 }}>
              {member ? `${member.lastName}, ${member.firstName}` : ""}
            </Typography>
          </Box>
          <IconButton
            aria-label="Close savings history"
            onClick={onClose}
            sx={{ width: 44, height: 44, color: "inherit" }}
          >
            <Close />
          </IconButton>
        </Stack>
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Current Savings
          </Typography>
          <Typography variant="h5" fontWeight={800}>
            {formatCurrency(currentSavings)}
          </Typography>
        </Box>
      </Box>

      <Tabs
        value={scope}
        onChange={(_, value: SavingsHistoryScope) => setScope(value)}
        variant={fullScreen ? "fullWidth" : "standard"}
        aria-label="Savings history sections"
        sx={{
          px: { xs: 0, sm: 2 },
          borderBottom: 1,
          borderColor: "divider",
          flexShrink: 0,
        }}
      >
        <Tab value="ledger" label="Savings Ledger" />
        <Tab value="legacy" label="Legacy Transactions" />
      </Tabs>

      <DialogContent
        sx={{ p: 0, display: "flex", flexDirection: "column", minHeight: 0 }}
      >
        <Box sx={{ px: { xs: 2, sm: 3 }, pt: 2, pb: 1 }}>
          <Typography variant="subtitle1" fontWeight={800}>
            {scope === "ledger"
              ? "Savings Ledger"
              : "Legacy Transactions (Pre-Ledger)"}
          </Typography>
          {scope === "legacy" && (
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              These transactions were recorded before detailed savings ledger
              tracking was enabled.
            </Typography>
          )}
        </Box>

        <ActiveHistoryPanel
          key={`${memberId}:${scope}`}
          memberId={memberId}
          scope={scope}
          page={page}
          compact={compact}
          enabled={open}
          onPageChange={setPage}
        />
      </DialogContent>
    </Dialog>
  );
}
