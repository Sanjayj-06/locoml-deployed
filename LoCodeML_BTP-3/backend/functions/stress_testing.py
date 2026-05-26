import numpy as np
import pandas as pd

def get_severity_percentage(severity):
    if isinstance(severity, str):
        s = severity.lower()
        if s == 'low':
            return 0.05
        elif s == 'medium':
            return 0.15
        elif s == 'high':
            return 0.30
    elif isinstance(severity, (int, float)):
        return float(severity)
    return 0.15  # default

def inject_noise(df, severity, target_column=None):
    """
    Adds Gaussian noise scaled by the standard deviation of each numerical column.
    """
    df_corrupted = df.copy()
    p = get_severity_percentage(severity)
    numeric_cols = [col for col in df.columns if col != target_column and pd.api.types.is_numeric_dtype(df[col])]
    
    for col in numeric_cols:
        df_corrupted[col] = df_corrupted[col].astype(float)
        std = df[col].std()
        if pd.isna(std) or std == 0:
            std = 1.0
        
        n_corrupted = int(len(df) * p)
        if n_corrupted == 0:
            n_corrupted = min(1, len(df))
            
        corrupt_indices = np.random.choice(df.index, size=n_corrupted, replace=False)
        noise = np.random.normal(0, 0.5 * std, size=n_corrupted)
        df_corrupted.loc[corrupt_indices, col] += noise
        
    return df_corrupted

def inject_missing_values(df, severity, target_column=None):
    """
    Randomly replaces elements with NaN values across all feature columns.
    """
    df_corrupted = df.copy()
    p = get_severity_percentage(severity)
    feature_cols = [col for col in df.columns if col != target_column]
    
    for col in feature_cols:
        if df_corrupted[col].dtype == 'int64':
            df_corrupted[col] = df_corrupted[col].astype(float)
            
        n_corrupted = int(len(df) * p)
        if n_corrupted == 0:
            n_corrupted = min(1, len(df))
            
        corrupt_indices = np.random.choice(df.index, size=n_corrupted, replace=False)
        df_corrupted.loc[corrupt_indices, col] = np.nan
        
    return df_corrupted

def inject_feature_drift(df, severity, target_column=None):
    """
    Shifts numerical distributions by constant factor of std, and swaps categorical levels.
    """
    df_corrupted = df.copy()
    p = get_severity_percentage(severity)
    
    for col in df.columns:
        if col == target_column:
            continue
            
        if pd.api.types.is_numeric_dtype(df[col]):
            df_corrupted[col] = df_corrupted[col].astype(float)
            std = df[col].std()
            if pd.isna(std) or std == 0:
                std = 1.0
                
            n_corrupted = int(len(df) * p)
            if n_corrupted == 0:
                n_corrupted = min(1, len(df))
                
            corrupt_indices = np.random.choice(df.index, size=n_corrupted, replace=False)
            df_corrupted.loc[corrupt_indices, col] += 2.0 * std
        else:
            unique_vals = [v for v in df[col].dropna().unique() if v != '']
            if len(unique_vals) > 0:
                n_corrupted = int(len(df) * p)
                if n_corrupted == 0:
                    n_corrupted = min(1, len(df))
                    
                corrupt_indices = np.random.choice(df.index, size=n_corrupted, replace=False)
                choices = unique_vals + ["drifted_unknown"]
                df_corrupted.loc[corrupt_indices, col] = np.random.choice(choices, size=n_corrupted)
                
    return df_corrupted

def inject_outliers(df, severity, target_column=None):
    """
    Replaces values with extreme outliers (+/- 5 * std from mean).
    """
    df_corrupted = df.copy()
    p = get_severity_percentage(severity)
    numeric_cols = [col for col in df.columns if col != target_column and pd.api.types.is_numeric_dtype(df[col])]
    
    for col in numeric_cols:
        df_corrupted[col] = df_corrupted[col].astype(float)
        mean = df[col].mean()
        std = df[col].std()
        if pd.isna(std) or std == 0:
            std = 1.0
            
        n_corrupted = int(len(df) * p)
        if n_corrupted == 0:
            n_corrupted = min(1, len(df))
            
        corrupt_indices = np.random.choice(df.index, size=n_corrupted, replace=False)
        directions = np.random.choice([-1, 1], size=n_corrupted)
        df_corrupted.loc[corrupt_indices, col] = mean + directions * 5.0 * std
        
    return df_corrupted
