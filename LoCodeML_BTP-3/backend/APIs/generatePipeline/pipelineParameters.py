class PipelineParameters:
    def __init__(self):
        self.dataset_name = None
        self.dataset_type = None
        self.preprocessing_steps = None
        self.task = None
        self.model_type = None
        self.additional_info = None
    
    def get_all_params(self):
        return [
            'dataset__name',
            'dataset__type',
            'preprocessing_steps',
            'task',
            'model_type',
            'additional_info'
        ]
    
    def get_must_required_params(self):
        return ['dataset__name']