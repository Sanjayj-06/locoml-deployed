import os
import pandas as pd
from .graph_serializer import GraphSerializer
from .validation_engine import ValidationEngine

class Analyzer:
    @staticmethod
    def get_dataset_metadata(dataset_path, original_filename=None):
        """
        Dynamically extracts columns, data types, and basic statistics from pandas
        if the dataset file exists.
        """
        display_name = original_filename or (os.path.basename(dataset_path) if dataset_path else "Unknown")
        if not dataset_path or not os.path.exists(dataset_path):
            return {
                "name": display_name,
                "error": "Dataset file not found or inaccessible"
            }
        
        try:
            _, ext = os.path.splitext(dataset_path)
            if ext.lower() == '.csv':
                df = pd.read_csv(dataset_path, nrows=5)
                full_df = pd.read_csv(dataset_path)
                return {
                    "name": display_name,
                    "columns": list(df.columns),
                    "shape": list(full_df.shape),
                    "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
                    "sample_head": df.head(3).to_dict(orient='records')
                }
        except Exception as e:
            return {
                "name": display_name,
                "error": f"Failed to parse dataset: {str(e)}"
            }
        
        return {"name": display_name, "status": "unsupported format"}

    @classmethod
    def analyze_pipeline(cls, nodes, edges, dataset_path=None, original_filename=None, pipeline_mode=None, execution_context=None):
        """
        Gathers graph structure, dataset metadata, and local validation issues
        to construct a comprehensive debugging context.
        """
        dataset_meta = None
        if dataset_path:
            dataset_meta = cls.get_dataset_metadata(dataset_path, original_filename=original_filename)
        
        # Run local validation
        validation_res = ValidationEngine.validate_graph(
            nodes, edges, dataset_meta, 
            pipeline_mode=pipeline_mode, 
            execution_context=execution_context
        )
        
        # Serialize graph
        serialized_graph = GraphSerializer.serialize(nodes, edges)
        
        return {
            "serialized_graph": serialized_graph,
            "dataset_meta": dataset_meta,
            "validation": validation_res
        }
