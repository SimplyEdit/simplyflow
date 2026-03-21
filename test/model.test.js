import { model } from "../src/model.mjs";
import { effect } from "../src/state.mjs";

describe("model", () => {
  // Missing test for when provided modal data object does not contain expected property: 'data'
  // see: https://github.com/SimplyEdit/simplyflow/blob/main/docs/model.md#setting-the-model-up

  it("contains view.current after initiation", () => {
    // Given - a bit of test data
    const modelConfig = { data: [] };

    // When - the model is created with the testdata
    const testModel = model(modelConfig);

    // Then - expect to have a view with property current
    expect(testModel.view).toHaveProperty("current");
  });

  it("renders with an effect attached", () => {
    // Given - test data and an effect that just passes through the data as is
    function createPassThroughEffect(data) {
      const defaultEffect = effect(() => {
        return data.current.slice();
      });

      return defaultEffect;
    }
    const modelConfig = { data: [] };
    const testModel = model(modelConfig);

    // When - the effect is added
    testModel.addEffect(createPassThroughEffect);

    // Then - the testdata stays intact inside view.current
    expect(testModel.view).toHaveProperty("current");
    expect(testModel.view.current).toStrictEqual([])
  });
});
