import { useState } from 'react';
import { Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField, Button } from '@mui/material';

const PasteInferencePipelineDialog = ({ open, handleClose, handlePaste }) => {
    const [pipelineLink, setPipelineLink] = useState('');
    const [error, setError] = useState('');

    const onPaste = () => {
        const rawInput = pipelineLink.trim();
        if (!rawInput) {
            setError('Please enter a pipeline link or ID.');
            return;
        }

        // Parse/validate link or ID
        const extractPipelineId = (input) => {
            const match = input.match(/\/pipeline\/([0-9A-Z]{6})(?:\/|\?|$)/i);
            if (match) return match[1].toUpperCase();
            if (/^[0-9A-Z]{6}$/i.test(input)) return input.toUpperCase();
            return null;
        };

        const pipelineId = extractPipelineId(rawInput);
        if (!pipelineId) {
            setError('Invalid link or ID format. Must contain a 6-character saved pipeline ID.');
            return;
        }

        setError('');
        handlePaste(pipelineId);
        setPipelineLink('');
    };

    const onCloseDialog = () => {
        setPipelineLink('');
        setError('');
        handleClose();
    };

    return (
        <Dialog open={open} onClose={onCloseDialog} fullWidth maxWidth="sm">
            <DialogTitle>Paste Saved Pipeline</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    Enter a saved pipeline link or 6-character ID (e.g. 9RUFXG) to load the pipeline flow.
                </DialogContentText>
                <TextField
                    autoFocus
                    margin="dense"
                    id="pipeline-link"
                    label="Pipeline Link or ID"
                    type="text"
                    fullWidth
                    value={pipelineLink}
                    onChange={(e) => {
                        setPipelineLink(e.target.value);
                        setError('');
                    }}
                    error={!!error}
                    helperText={error}
                />
            </DialogContent>
            <DialogActions style={{ padding: '8px 24px 16px' }}>
                <Button onClick={onCloseDialog} color="secondary" variant="outlined" style={{ borderRadius: '15px', textTransform: 'none' }}>
                    Cancel
                </Button>
                <Button onClick={onPaste} color="primary" variant="contained" style={{ borderRadius: '15px', textTransform: 'none', backgroundColor: '#333333' }}>
                    Load Pipeline
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default PasteInferencePipelineDialog;
