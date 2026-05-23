class GraphSerializer:
    @staticmethod
    def serialize(nodes, edges):
        """
        Converts ReactFlow graph data into a token-efficient structured JSON format
        for feeding into the LLM debugging context.
        """
        serialized_nodes = []
        for n in nodes:
            data = n.get('data', {})
            serialized_nodes.append({
                "id": n.get('id'),
                "type": n.get('type'),
                "label": data.get('label'),
                "entity": data.get('entity'),
                "model_id": n.get('model_id') or data.get('model_id'),
                "estimator": n.get('estimator'),
                "artifact_path": n.get('artifact_path'),
                "task_type": n.get('task_type'),
                "bound_model": n.get('bound_model') or data.get('bound_model'),
                "preprocessingType": data.get('preprocessingType'),
                "parameters": data.get('parameters'),
            })

        serialized_edges = []
        for e in edges:
            serialized_edges.append({
                "id": e.get('id'),
                "source": e.get('source'),
                "target": e.get('target')
            })

        return {
            "nodes": serialized_nodes,
            "edges": serialized_edges
        }
