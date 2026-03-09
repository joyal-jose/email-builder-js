import React, { useEffect } from 'react';

import { Box, CircularProgress, Stack, Typography, useTheme } from '@mui/material';

import {
  loadDocumentFromApi,
  useInspectorDrawerOpen,
  useIsLoadingTemplate,
  useLoadTemplateError,
} from '../documents/editor/EditorContext';
import { canEditCurrentTemplate } from '../documents/editor/templateApi';

import InspectorDrawer, { INSPECTOR_DRAWER_WIDTH } from './InspectorDrawer';
import TemplatePanel from './TemplatePanel';

function useDrawerTransition(cssProperty: 'margin-left' | 'margin-right', open: boolean) {
  const { transitions } = useTheme();
  return transitions.create(cssProperty, {
    easing: !open ? transitions.easing.sharp : transitions.easing.easeOut,
    duration: !open ? transitions.duration.leavingScreen : transitions.duration.enteringScreen,
  });
}

export default function App() {
  const canEdit = canEditCurrentTemplate();
  const inspectorDrawerOpen = useInspectorDrawerOpen();
  const isLoadingTemplate = useIsLoadingTemplate();
  const loadTemplateError = useLoadTemplateError();
  const marginRightTransition = useDrawerTransition('margin-right', inspectorDrawerOpen);
  useEffect(() => {
    loadDocumentFromApi().catch((error) => {
      console.error('Unable to load template from API.', error);
    });
  }, []);

  return (
    <>
      {canEdit && !isLoadingTemplate && <InspectorDrawer />}

      <Stack
        sx={{
          marginRight: canEdit && !isLoadingTemplate && inspectorDrawerOpen ? `${INSPECTOR_DRAWER_WIDTH}px` : 0,
          transition: marginRightTransition,
        }}
      >
        {isLoadingTemplate ? (
          <Box
            sx={{
              height: '100vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">
              Loading template...
            </Typography>
          </Box>
        ) : loadTemplateError ? (
          <Box
            sx={{
              height: '100vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              px: 3,
            }}
          >
            <Typography variant="body2" color="error.main">
              {loadTemplateError}
            </Typography>
          </Box>
        ) : (
          <TemplatePanel />
        )}
      </Stack>
    </>
  );
}
