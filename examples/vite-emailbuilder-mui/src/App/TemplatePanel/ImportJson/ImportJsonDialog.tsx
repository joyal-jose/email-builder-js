import React, { useRef, useState } from 'react';

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  TextField,
  Typography,
} from '@mui/material';

import { resetDocument } from '../../../documents/editor/EditorContext';

import validateJsonStringValue from './validateJsonStringValue';

type ImportJsonDialogProps = {
  onClose: () => void;
};
export default function ImportJsonDialog({ onClose }: ImportJsonDialogProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleChange: React.ChangeEventHandler<HTMLTextAreaElement | HTMLInputElement> = (ev) => {
    const v = ev.currentTarget.value;
    setValue(v);
    const { error } = validateJsonStringValue(v);
    setError(error ?? null);
  };

  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (ev) => {
    const file = ev.currentTarget.files?.[0];
    if (!file) {
      return;
    }

    const fileContents = await file.text();
    setValue(fileContents);

    const validationResult = validateJsonStringValue(fileContents);
    setError(validationResult.error ?? null);

    // Allow re-selecting the same file.
    ev.currentTarget.value = '';
  };

  let errorAlert = null;
  if (error) {
    errorAlert = <Alert color="error">{error}</Alert>;
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Import JSON</DialogTitle>
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          const { error, data } = validateJsonStringValue(value);
          setError(error ?? null);
          if (!data) {
            return;
          }
          resetDocument(data);
          onClose();
        }}
      >
        <DialogContent>
          <Typography color="text.secondary" paragraph>
            Copy and paste an EmailBuilder.js JSON (
            <Link
              href="https://gist.githubusercontent.com/jordanisip/efb61f56ba71bd36d3a9440122cb7f50/raw/30ea74a6ac7e52ebdc309bce07b71a9286ce2526/emailBuilderTemplate.json"
              target="_blank"
              underline="none"
            >
              example
            </Link>
            ).
          </Typography>
          <Button type="button" onClick={handleSelectFile} sx={{ mb: 2 }}>
            Choose JSON file
          </Button>
          <input
            ref={fileInputRef}
            hidden
            type="file"
            accept="application/json,.json"
            onChange={handleFileChange}
          />
          {errorAlert}
          <TextField
            error={error !== null}
            value={value}
            onChange={handleChange}
            type="text"
            helperText="This will override your current template."
            variant="outlined"
            fullWidth
            rows={10}
            multiline
          />
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="contained" type="submit" disabled={error !== null}>
            Import
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
