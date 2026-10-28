import { useEffect, useMemo, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import CheckCircle from "@mui/icons-material/CheckCircle";
import Close from "@mui/icons-material/Close";
import ErrorOutline from "@mui/icons-material/ErrorOutline";
import MarkEmailRead from "@mui/icons-material/MarkEmailRead";
import SmsOutlined from "@mui/icons-material/SmsOutlined";
import WarningAmber from "@mui/icons-material/WarningAmber";
import { smsNotificationsApi } from "../api";
import type {
  SmsEligibilityItem,
  SmsEventType,
  SmsRequestResult,
  SmsStatusResult,
} from "../types";

interface SendSmsConfirmationDialogProps {
  open: boolean;
  eventType: SmsEventType;
  title: string;
  candidates: SmsEligibilityItem[];
  onClose: () => void;
}

type DialogState =
  "idle" | "submitting" | "polling" | "sent" | "queued" | "failed";

const formatCurrency = (value: number) =>
  `PHP ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const isSelectable = (candidate: SmsEligibilityItem) =>
  candidate.eligible && candidate.notificationStatus === null;

export default function SendSmsConfirmationDialog({
  open,
  eventType,
  title,
  candidates,
  onClose,
}: SendSmsConfirmationDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, setState] = useState<DialogState>("idle");
  const [results, setResults] = useState<SmsRequestResult[]>([]);
  const [status, setStatus] = useState<SmsStatusResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  const selectable = useMemo(
    () => candidates.filter(isSelectable),
    [candidates],
  );
  const isBulk = eventType === "repayment_posted" && candidates.length > 1;

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      if (pollTimerRef.current !== null) {
        window.clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }
    setSelected(new Set(selectable.map((candidate) => candidate.resourceId)));
    setState("idle");
    setResults([]);
    setStatus(null);
    setErrorMessage(null);
  }, [open, selectable]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (pollTimerRef.current !== null) {
        window.clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    },
    [],
  );

  const close = () => {
    abortRef.current?.abort();
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    onClose();
  };

  const waitForNextPoll = (controller: AbortController) =>
    new Promise<void>((resolve) => {
      const finish = () => {
        controller.signal.removeEventListener("abort", cancel);
        pollTimerRef.current = null;
        resolve();
      };
      const cancel = () => {
        if (pollTimerRef.current !== null) {
          window.clearTimeout(pollTimerRef.current);
        }
        finish();
      };

      pollTimerRef.current = window.setTimeout(finish, 1_000);
      controller.signal.addEventListener("abort", cancel, { once: true });
    });

  const pollSingle = async (notificationId: string) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setState("polling");

    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (controller.signal.aborted) return;
      if (attempt > 0) {
        await waitForNextPoll(controller);
      }
      if (controller.signal.aborted) return;
      const current = await smsNotificationsApi.getStatus(
        notificationId,
        controller.signal,
      );
      setStatus(current);
      if (current.status === "sent") {
        setState("sent");
        return;
      }
      if (current.status === "failed") {
        setErrorMessage(
          current.errorMessage || "The SMS provider rejected the message.",
        );
        setState("failed");
        return;
      }
    }

    setState("queued");
  };

  const send = async (allEligible: boolean) => {
    if (state === "submitting" || state === "polling") return;
    const ids = allEligible
      ? selectable.map((candidate) => candidate.resourceId)
      : [...selected];
    if (!ids.length) return;

    setState("submitting");
    setErrorMessage(null);
    try {
      if (eventType === "loan_created") {
        const result = await smsNotificationsApi.requestLoanSms(ids[0]);
        setResults([result]);
        if (result.status === "sent") {
          setState("sent");
        } else if (result.status === "failed") {
          setErrorMessage(result.errorMessage || "The SMS could not be sent.");
          setState("failed");
        } else if (result.notificationId) {
          await pollSingle(result.notificationId);
        }
      } else {
        const response = await smsNotificationsApi.requestRepaymentBatch(ids);
        setResults(response.items);
        const singleNotificationId = response.items[0]?.notificationId;
        if (!isBulk && singleNotificationId) {
          const item = response.items[0];
          if (item.status === "sent") setState("sent");
          else if (item.status === "failed") {
            setErrorMessage(item.errorMessage || "The SMS could not be sent.");
            setState("failed");
          } else await pollSingle(singleNotificationId);
        } else {
          setState("queued");
        }
      }
    } catch (error: unknown) {
      const responseMessage = (
        error as { response?: { data?: { message?: string | string[] } } }
      )?.response?.data?.message;
      setErrorMessage(
        Array.isArray(responseMessage)
          ? responseMessage.join(" ")
          : responseMessage ||
              "SMS could not be queued. The financial transaction remains successful.",
      );
      setState("failed");
    }
  };

  const toggle = (resourceId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(resourceId)) next.delete(resourceId);
      else next.add(resourceId);
      return next;
    });
  };

  const busy = state === "submitting" || state === "polling";
  const terminal = state === "sent" || state === "queued" || state === "failed";
  const queuedCount = results.filter((item) =>
    ["pending", "processing"].includes(item.status),
  ).length;
  const alreadySentCount = results.filter(
    (item) => item.status === "sent" && !item.created,
  ).length;

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : close}
      fullWidth
      maxWidth="sm"
      aria-labelledby="send-sms-dialog-title"
    >
      <DialogTitle
        id="send-sms-dialog-title"
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.5,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <CheckCircle color="success" />
          <Box>
            <Typography variant="h6" fontWeight={700}>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              The financial transaction is complete.
            </Typography>
          </Box>
        </Box>
        <IconButton
          aria-label="Close SMS notification"
          onClick={close}
          disabled={busy}
          sx={{ width: 44, height: 44, flexShrink: 0 }}
        >
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {state === "idle" && (
          <>
            <Typography sx={{ mb: 2 }}>
              Would you like to send an SMS notification?
            </Typography>
            <List disablePadding>
              {candidates.map((candidate, index) => {
                const selectableRow = isSelectable(candidate);
                return (
                  <Box key={candidate.resourceId}>
                    {index > 0 && <Divider />}
                    <ListItem
                      disableGutters
                      secondaryAction={
                        isBulk && selectableRow ? (
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={selected.has(candidate.resourceId)}
                                onChange={() => toggle(candidate.resourceId)}
                              />
                            }
                            label=""
                          />
                        ) : undefined
                      }
                    >
                      <ListItemText
                        primary={candidate.memberName}
                        secondary={
                          <>
                            {eventType === "repayment_posted" && (
                              <Typography
                                component="span"
                                variant="body2"
                                display="block"
                              >
                                {formatCurrency(candidate.amount)}
                              </Typography>
                            )}
                            <Typography
                              component="span"
                              variant="body2"
                              display="block"
                            >
                              {candidate.recipientMasked ||
                                candidate.errorMessage ||
                                "No contact number"}
                            </Typography>
                          </>
                        }
                      />
                      <Chip
                        size="small"
                        icon={
                          selectableRow ? (
                            <SmsOutlined />
                          ) : candidate.notificationStatus === "sent" ? (
                            <MarkEmailRead />
                          ) : (
                            <WarningAmber />
                          )
                        }
                        color={
                          selectableRow
                            ? "success"
                            : candidate.notificationStatus === "sent"
                              ? "info"
                              : "warning"
                        }
                        label={
                          candidate.notificationStatus === "sent"
                            ? "Already sent"
                            : candidate.notificationStatus === "pending" ||
                                candidate.notificationStatus === "processing"
                              ? "Already queued"
                              : candidate.notificationStatus === "failed"
                                ? "Failed"
                                : selectableRow
                                  ? "Ready"
                                  : candidate.errorCode ===
                                      "MISSING_CONTACT_NUMBER"
                                    ? "Missing contact"
                                    : "Invalid contact"
                        }
                        sx={{ mr: isBulk ? 5 : 0 }}
                      />
                    </ListItem>
                  </Box>
                );
              })}
            </List>
          </>
        )}

        {(state === "submitting" || state === "polling") && (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <CircularProgress size={34} />
            <Typography sx={{ mt: 2 }} fontWeight={600}>
              Sending SMS...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              The completed financial transaction is not affected.
            </Typography>
          </Box>
        )}

        {state === "sent" && (
          <Alert severity="success" icon={<MarkEmailRead />}>
            SMS sent successfully. UniSMS accepted the message.
          </Alert>
        )}
        {state === "queued" && (
          <>
            <Alert severity="info" icon={<SmsOutlined />}>
              {isBulk
                ? `${queuedCount} SMS notification${queuedCount === 1 ? "" : "s"} queued. ${alreadySentCount ? `${alreadySentCount} already sent.` : ""}`
                : "SMS delivery is temporarily delayed. The system will retry automatically."}
            </Alert>
            {isBulk && (
              <List dense sx={{ mt: 1 }}>
                {candidates.map((candidate) => {
                  const result = results.find(
                    (item) => item.resourceId === candidate.resourceId,
                  );
                  const label = result
                    ? result.status === "sent"
                      ? result.created
                        ? "Sent"
                        : "Already sent"
                      : result.status === "failed"
                        ? "Failed"
                        : "Queued"
                    : candidate.errorCode === "MISSING_CONTACT_NUMBER"
                      ? "Missing contact"
                      : candidate.errorCode === "INVALID_CONTACT_NUMBER"
                        ? "Invalid contact"
                        : candidate.notificationStatus === "sent"
                          ? "Already sent"
                          : "Not selected";
                  return (
                    <ListItem key={candidate.resourceId} disableGutters>
                      <ListItemText
                        primary={candidate.memberName}
                        secondary={
                          result?.errorMessage ||
                          candidate.errorMessage ||
                          candidate.recipientMasked
                        }
                      />
                      <Chip
                        size="small"
                        label={label}
                        color={
                          label === "Queued" || label === "Sent"
                            ? "success"
                            : label === "Failed"
                              ? "error"
                              : "default"
                        }
                      />
                    </ListItem>
                  );
                })}
              </List>
            )}
          </>
        )}
        {state === "failed" && (
          <Alert severity="error" icon={<ErrorOutline />}>
            <Typography fontWeight={700}>SMS could not be sent.</Typography>
            <Typography variant="body2">
              {errorMessage ||
                status?.errorMessage ||
                "Please contact an administrator."}
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              The financial transaction remains successful.
            </Typography>
          </Alert>
        )}
      </DialogContent>
      <DialogActions
        aria-label="SMS notification actions"
        sx={{
          p: 2.5,
          gap: 1,
          flexDirection: { xs: "column-reverse", sm: "row" },
          alignItems: { xs: "stretch", sm: "center" },
          "& > .MuiButton-root": {
            minHeight: 44,
            width: { xs: "100%", sm: "auto" },
            m: 0,
          },
        }}
      >
        <Button onClick={close} disabled={busy}>
          {terminal ? "Close" : "Don't Send"}
        </Button>
        {!terminal && isBulk && (
          <Button
            variant="outlined"
            onClick={() => send(false)}
            disabled={busy || selected.size === 0}
          >
            Send Selected ({selected.size})
          </Button>
        )}
        {!terminal && (
          <Button
            variant="contained"
            startIcon={
              busy ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <SmsOutlined />
              )
            }
            onClick={() => send(true)}
            disabled={busy || selectable.length === 0}
          >
            {isBulk ? `Send All ${selectable.length}` : "Send SMS"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
