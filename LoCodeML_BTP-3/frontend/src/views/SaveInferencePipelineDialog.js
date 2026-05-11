import { useState } from 'react';
import { Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField, Button } from '@mui/material';

const SaveInferencePipelineDialog = ({ open, handleClose, handleSave }) => {
    const [pipelineName, setPipelineName] = useState('');
    const [error, setError] = useState(false);

    const onSave = () => {
        if (!pipelineName.trim()) {
            setError(true);
        } else {
            handleSave(pipelineName.trim());
            setPipelineName('');
            setError(false);
        }
    };

    return (
        <Dialog open={open} onClose={handleClose}>
            <DialogTitle>Save Pipeline</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    Please enter a name for this pipeline.
                </DialogContentText>
                <TextField
                    autoFocus
                    margin="dense"
                    id="name"
                    label="Pipeline Name"
                    type="text"
                    fullWidth
                    value={pipelineName}
                    onChange={(e) => setPipelineName(e.target.value)}
                    error={error} // Apply error state to TextField
                    helperText={error ? "Pipeline name is required" : ""} // Show error message if pipeline name is empty
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} color="primary">
                    Cancel
                </Button>
                <Button onClick={onSave} color="primary">
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default SaveInferencePipelineDialog;
