import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";
import Close from "@mui/icons-material/Close";
import ContentCopy from "@mui/icons-material/ContentCopy";

interface TempPasswordDialogProps {
  open: boolean;
  title: string;
  password: string;
  onClose: () => void;
}

export default function TempPasswordDialog({
  open,
  title,
  password,
  onClose,
}: TempPasswordDialogProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy password:", err);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="temporary-password-dialog-title"
      PaperProps={{ sx: { bgcolor: "background.paper" } }}
    >
      <DialogTitle
        id="temporary-password-dialog-title"
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          px: { xs: 2, sm: 3 },
          py: 2,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography component="span" variant="h5">
          {title}
        </Typography>
        <IconButton
          aria-label="Close temporary password"
          onClick={onClose}
          sx={{ width: 44, height: 44 }}
        >
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent
        sx={{ px: { xs: 2, sm: 3 }, py: 3, "&:first-of-type": { pt: 3 } }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          This password is shown only once. Please copy it now.
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <TextField
            fullWidth
            label="Temporary password"
            value={password}
            InputProps={{ readOnly: true }}
          />
          <IconButton
            aria-label="Copy temporary password"
            onClick={() => void handleCopy()}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              width: 44,
              height: 44,
              flexShrink: 0,
            }}
          >
            <ContentCopy fontSize="small" />
          </IconButton>
        </Box>
        {copied && (
          <Alert severity="success" aria-live="polite" sx={{ mt: 2 }}>
            Copied to clipboard.
          </Alert>
        )}
      </DialogContent>
      <DialogActions
        sx={{
          px: { xs: 2, sm: 3 },
          py: 2,
          borderTop: "1px solid",
          borderColor: "divider",
        }}
      >
        <Button variant="contained" onClick={onClose}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}
