import React, { useRef, useState } from 'react';
import { ZodError } from 'zod';

import {
    VerticalAlignBottomOutlined,
    VerticalAlignCenterOutlined,
    VerticalAlignTopOutlined,
} from '@mui/icons-material';
import { Button, Stack, ToggleButton, Typography } from '@mui/material';
import { ImageProps, ImagePropsSchema } from '@usewaypoint/block-image';
import { uploadImageFile } from '../../../../documents/editor/templateApi';

import BaseSidebarPanel from './helpers/BaseSidebarPanel';
import RadioGroupInput from './helpers/inputs/RadioGroupInput';
import TextDimensionInput from './helpers/inputs/TextDimensionInput';
import TextInput from './helpers/inputs/TextInput';
import MultiStylePropertyPanel from './helpers/style-inputs/MultiStylePropertyPanel';

type ImageSidebarPanelProps = {
    data: ImageProps;
    setData: (v: ImageProps) => void;
};
export default function ImageSidebarPanel({ data, setData }: ImageSidebarPanelProps) {
    const [, setErrors] = useState<ZodError | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const updateData = (d: unknown) => {
        const res = ImagePropsSchema.safeParse(d);
        if (res.success) {
            setData(res.data);
            setErrors(null);
        } else {
            setErrors(res.error);
        }
    };

    const handleFileSelect: React.ChangeEventHandler<HTMLInputElement> = async (ev) => {
        const file = ev.currentTarget.files?.[0];
        if (!file) {
            return;
        }

        setUploadError(null);
        setUploading(true);
        try {
            const publicUrl = await uploadImageFile(file);
            updateData({ ...data, props: { ...data.props, url: publicUrl } });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to upload image';
            setUploadError(message);
        } finally {
            setUploading(false);
            ev.currentTarget.value = '';
        }
    };

    return (
        <BaseSidebarPanel title="Image block">
            <Stack spacing={1}>
                <Button type="button" variant="outlined" size="small" onClick={() => fileInputRef.current?.click()}>
                    {uploading ? 'Uploading...' : 'Upload image'}
                </Button>
                <input
                    ref={fileInputRef}
                    hidden
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                    onChange={handleFileSelect}
                />
                {uploadError && (
                    <Typography variant="caption" color="error.main">
                        {uploadError}
                    </Typography>
                )}
            </Stack>

            <TextInput
                label="Source URL"
                defaultValue={data.props?.url ?? ''}
                onChange={(v) => {
                    const url = v.trim().length === 0 ? null : v.trim();
                    updateData({ ...data, props: { ...data.props, url } });
                }}
            />

            <TextInput
                label="Alt text"
                defaultValue={data.props?.alt ?? ''}
                onChange={(alt) => updateData({ ...data, props: { ...data.props, alt } })}
            />
            <TextInput
                label="Click through URL"
                defaultValue={data.props?.linkHref ?? ''}
                onChange={(v) => {
                    const linkHref = v.trim().length === 0 ? null : v.trim();
                    updateData({ ...data, props: { ...data.props, linkHref } });
                }}
            />
            <Stack direction="row" spacing={2}>
                <TextDimensionInput
                    label="Width"
                    defaultValue={data.props?.width}
                    onChange={(width) => updateData({ ...data, props: { ...data.props, width } })}
                />
                <TextDimensionInput
                    label="Height"
                    defaultValue={data.props?.height}
                    onChange={(height) => updateData({ ...data, props: { ...data.props, height } })}
                />
            </Stack>

            <RadioGroupInput
                label="Alignment"
                defaultValue={data.props?.contentAlignment ?? 'middle'}
                onChange={(contentAlignment) => updateData({ ...data, props: { ...data.props, contentAlignment } })}
            >
                <ToggleButton value="top">
                    <VerticalAlignTopOutlined fontSize="small" />
                </ToggleButton>
                <ToggleButton value="middle">
                    <VerticalAlignCenterOutlined fontSize="small" />
                </ToggleButton>
                <ToggleButton value="bottom">
                    <VerticalAlignBottomOutlined fontSize="small" />
                </ToggleButton>
            </RadioGroupInput>

            <MultiStylePropertyPanel
                names={['backgroundColor', 'textAlign', 'padding']}
                value={data.style}
                onChange={(style) => updateData({ ...data, style })}
            />
        </BaseSidebarPanel>
    );
}
