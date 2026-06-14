import torch
import ultralytics.nn.tasks as tasks_module

from core.encoding import safe_print


def patch_ultralytics_safe_load():
    def patched_torch_safe_load(weight):
        try:
            return torch.load(weight, map_location="cpu", weights_only=False), weight
        except Exception as exc:
            safe_print(f"Error loading weight: {exc}")
            raise

    tasks_module.torch_safe_load = patched_torch_safe_load

