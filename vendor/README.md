# 외부 구성 요소

| 폴더 | 내용 | 출처·라이선스 |
| --- | --- | --- |
| `ort/` | ONNX Runtime Web 1.20.1 (브라우저에서 AI 모델을 돌리는 엔진) | Microsoft, MIT License |
| `models/isnet_small.onnx` | 배경 지우기 AI 모델 (IS-Net, 8비트 경량판) | `@imgly/background-removal-node` 1.4.5에 포함된 모델, AGPL-3.0 |

모델은 사이트를 처음 쓸 때 한 번만 내려받고, 이후에는 브라우저에 저장된 것을 씁니다.
