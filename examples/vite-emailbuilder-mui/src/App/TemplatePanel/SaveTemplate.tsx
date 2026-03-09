import React, { useMemo, useState } from 'react';

import { SaveOutlined } from '@mui/icons-material';
import { Button, Stack, Typography } from '@mui/material';
import { renderToStaticMarkup } from '@usewaypoint/email-builder';

import { useDocument } from '../../documents/editor/EditorContext';
import { saveTemplateToApi } from '../../documents/editor/templateApi';

export default function SaveTemplate() {
  const document = useDocument();
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  console.log('status: ', status);
  const htmlCode = useMemo(() => renderToStaticMarkup(document, { rootBlockId: 'root' }), [document]);

  const handleSaveTemplate = async () => {
    setStatus('saving');
    try {
      await saveTemplateToApi(document, htmlCode);
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  };

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Button
        variant="contained"
        size="small"
        startIcon={<SaveOutlined fontSize="small" />}
        onClick={handleSaveTemplate}
        disabled={status === 'saving'}
        sx={{
          textTransform: 'none',
          fontWeight: 600,
          fontSize: 12,
          minHeight: 28,
          px: 1,
          borderRadius: 1,
          boxShadow: 'none',
          bgcolor: 'primary.main',
          '& .MuiButton-startIcon': {
            mr: 0.5,
            ml: 0,
          },
          '&:hover': {
            boxShadow: 'none',
            bgcolor: 'primary.dark',
          },
        }}
      >
        {status === 'saving' ? 'Saving...' : 'Save Template'}
      </Button>
      {status === 'saved' && (
        <Typography variant="caption" color="success.main">
          Saved
        </Typography>
      )}
      {status === 'error' && (
        <Typography variant="caption" color="error.main">
          Save failed
        </Typography>
      )}
    </Stack>
  );
}
