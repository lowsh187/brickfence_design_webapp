# Test Cases

## Document Control

- Project: Fence Calculator
- Scope: Brick dimension validation, stack bond generation, form state, and page interaction tests
- Author: Testing team
- Last updated: 2026-05-09
- Test levels: Unit test, component test
- Frameworks: Vitest, Testing Library

## Test Case Format

Each test case uses the following fields:

| Field | Description |
| --- | --- |
| Test Case ID | Unique identifier |
| Title | Short description of the test |
| Module | File or function under test |
| Preconditions | Required setup before execution |
| Test Data | Input values used in the test |
| Steps | Execution steps |
| Expected Result | Expected output or behavior |
| Status | Planned, Passed, Failed, Blocked |

## Unit Test Cases

| Test Case ID | Title | Module | Preconditions | Test Data | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-BD-001 | Validate default brick dimensions | `validateBrickDimensions()` | Test environment installed | Default brick dimensions | 1. Call function with default values. | Function returns `true`. | Passed |
| TC-BD-002 | Reject width below minimum | `validateBrickDimensions()` | Test environment installed | `width = MIN_BRICK_WIDTH - 1` | 1. Call function with width below minimum. | Function returns `false`. | Passed |
| TC-BD-003 | Reject invalid length formula | `validateBrickDimensions()` | Test environment installed | `length != width * 2 + mortar` | 1. Call function with mismatched length. | Function returns `false`. | Passed |
| TC-BD-004 | Reject non-positive height | `validateBrickDimensions()` | Test environment installed | `height = 0` | 1. Call function with height set to `0`. | Function returns `false`. | Passed |
| TC-BD-005 | Reject non-positive mortar | `validateBrickDimensions()` | Test environment installed | `mortar = 0` | 1. Call function with mortar set to `0`. | Function returns `false`. | Passed |
| TC-BD-006 | Parse custom numeric strings | `brickDimensionsFromStrings()` | Test environment installed | `"230"`, `"110"`, `"76"`, `"10"` | 1. Call function in `custom` mode. | Returned object contains parsed numbers. | Passed |
| TC-BD-007 | Use default dimensions in non-custom mode | `brickDimensionsFromStrings()` | Test environment installed | `brickSizeMode = default` | 1. Call function outside `custom` mode. | Default dimensions are returned. | Passed |
| TC-BD-008 | Fallback for empty inputs | `brickDimensionsFromStrings()` | Test environment installed | Empty strings | 1. Call function in `custom` mode with empty strings. | Default dimensions are returned. | Passed |
| TC-BD-009 | Fallback for invalid string inputs | `brickDimensionsFromStrings()` | Test environment installed | `"abc"` and other invalid strings | 1. Call function in `custom` mode with invalid strings. | Default dimensions are returned. | Passed |
| TC-BD-010 | Parse decimal and padded strings | `brickDimensionsFromStrings()` | Test environment installed | `" 230.5 "`, `"110.25"`, `"76.75"`, `"10.5"` | 1. Call function in `custom` mode with decimal and padded values. | Returned object contains parsed decimal numbers. | Passed |
| TC-BD-011 | Fallback only for partially invalid fields | `brickDimensionsFromStrings()` | Test environment installed | One invalid field such as `brickWidth = "abc"` | 1. Call function in `custom` mode with one invalid field and other valid fields. | Only the invalid field falls back to its default value. | Passed |
| TC-BD-012 | Fallback for zero string values | `brickDimensionsFromStrings()` | Test environment installed | `"0"` for all custom inputs | 1. Call function in `custom` mode with zero strings. | Default dimensions are returned because parsed zero is treated as falsy. | Passed |
| TC-BD-013 | Preserve negative parsed values before validation | `brickDimensionsFromStrings()` | Test environment installed | Negative numeric strings | 1. Call function in `custom` mode with negative strings. | Returned object contains negative numeric values for later validation. | Passed |
| TC-ST-001 | Generate stack bond result structure | `stackBond.generate()` | Test environment installed | `wallL = 1.0 m`, `wallH = 0.5 m`, default dimensions | 1. Call generator with typical wall data. | Result contains `bricks`, `brickCount`, `nRows`, `wallW`, `wallH`, `adjPieceLength`, and `snapped`. | Passed |
| TC-ST-002 | Verify brick list is populated | `stackBond.generate()` | Test environment installed | `wallL = 1.0 m`, `wallH = 0.5 m`, default dimensions | 1. Call generator with typical wall data. | `bricks.length > 0`. | Passed |
| TC-ST-003 | Verify row count is positive | `stackBond.generate()` | Test environment installed | `wallL = 1.0 m`, `wallH = 0.5 m`, default dimensions | 1. Call generator with typical wall data. | `nRows > 0`. | Passed |
| TC-ST-004 | Verify brick geometry is non-negative | `stackBond.generate()` | Test environment installed | `wallL = 1.0 m`, `wallH = 0.5 m`, default dimensions | 1. Call generator with typical wall data. 2. Inspect each brick. | Every brick has non-negative `x`, `y`, `w`, and `h`. | Passed |
| TC-ST-005 | Verify brick type is valid | `stackBond.generate()` | Test environment installed | `wallL = 1.0 m`, `wallH = 0.5 m`, default dimensions | 1. Call generator with typical wall data. 2. Inspect each brick type. | Every brick type is `full`, `half`, or `adj`. | Passed |
| TC-ST-006 | Handle a very small wall safely | `stackBond.generate()` | Test environment installed | `wallL = 0.04 m`, `wallH = 0.04 m`, default dimensions | 1. Call generator with a small wall. | Function returns a valid result structure without negative geometry. | Passed |
| TC-ST-007 | Verify wall height calculation formula | `stackBond.generate()` | Test environment installed | `wallL = 1.0 m`, `wallH = 0.5 m`, default dimensions | 1. Call generator. 2. Compute `nRows * (height + mortar) - mortar`. | `wallH` exactly matches the formula. | Passed |
| TC-ST-008 | Handle zero-length wall safely | `stackBond.generate()` | Test environment installed | `wallL = 0 m`, `wallH = 0.04 m`, default dimensions | 1. Call generator with zero wall length. | Returned result has `wallW = 0`, no bricks, and no negative values. | Passed |
| TC-ST-009 | Handle zero-height wall using the current row rule | `stackBond.generate()` | Test environment installed | `wallL = 1.0 m`, `wallH = 0 m`, default dimensions | 1. Call generator with zero wall height. | Returned result follows the current formula-based behavior and remains structurally valid. | Passed |

## Component and Interaction Test Cases

| Test Case ID | Title | Module | Preconditions | Test Data | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-FC-001 | Load default form state | `FormProvider` | `localStorage` empty and cookie consent enabled | No saved state | 1. Render a consumer inside `FormProvider`. | Default values such as `bondPattern = stretcher` are exposed. | Passed |
| TC-FC-002 | Load saved form state | `FormProvider` | Cookie consent enabled | Saved `localStorage` state with custom values | 1. Seed `localStorage`. 2. Render `FormProvider`. | Saved values are loaded into context state. | Passed |
| TC-FC-003 | Ignore saved state when storage is disabled | `FormProvider` | Cookie consent disabled | Saved `localStorage` state | 1. Seed `localStorage`. 2. Set `CookieConsent=false`. 3. Render `FormProvider`. | Context falls back to default state. | Passed |
| TC-FC-004 | Persist form updates | `FormProvider` | Cookie consent enabled | Dispatch `SET_FIELD` action | 1. Render `FormProvider`. 2. Update a field through context. | Updated state is written to `localStorage`. | Passed |
| TC-FC-005 | Reset form state | `FormProvider` | Cookie consent enabled | Dispatch `RESET` action | 1. Render `FormProvider`. 2. Change a field. 3. Dispatch reset. | Context returns to default values. | Passed |
| TC-DP-001 | Disable next button until dimensions are valid | `DimensionsPage.tsx` | Page rendered inside router and provider | Empty length and height | 1. Open dimensions page. 2. Inspect next button. 3. Enter valid wall length and height. | Next button is initially disabled and becomes enabled after valid input. | Passed |
| TC-DP-002 | Block progress when wall height exceeds limit | `DimensionsPage.tsx` | Page rendered inside router and provider | `height > 2` | 1. Enter valid length. 2. Enter height above the max. | Height error is shown, preview is hidden, and next remains disabled. | Passed |
| TC-DP-003 | Auto-update brick length from custom brick width | `DimensionsPage.tsx` | Page rendered inside router and provider | Custom brick width value | 1. Switch to custom brick mode. 2. Change brick width. | Brick length is recalculated to `width * 2 + mortar`. | Passed |
| TC-DP-004 | Navigate to bond page when dimensions are valid | `DimensionsPage.tsx` | Page rendered with a `/bond` route target | Valid wall length and height | 1. Enter valid dimensions. 2. Click next. | Router navigates to the bond step. | Passed |
| TC-BP-001 | Reveal pier controls when a pier type is selected | `BondPage.tsx` | Page rendered inside router and provider | `pierType = hidden` | 1. Open bond page. 2. Select hidden pier. | Pier size, height, spacing, and infill controls become visible. | Passed |
| TC-BP-002 | Disable unsupported hidden pier sizes for stack bond | `BondPage.tsx` | Page rendered inside router and provider | `bondPattern = stack`, `pierType = hidden` | 1. Select stack bond. 2. Select hidden pier. | Unsupported pier sizes are disabled and supported sizes remain enabled. | Passed |
| TC-BP-003 | Block progress when pier spacing is too wide | `BondPage.tsx` | Page rendered inside router and provider | `pierSpacing > 3` | 1. Select a pier type. 2. Enter spacing above the maximum. | Spacing error is shown, preview is hidden, and next is disabled. | Passed |
| TC-BP-004 | Reset cut-brick mode when selected bond does not support no-cut | `BondPage.tsx` | Page rendered with saved state | Saved state with `bondPattern = english` and `cutBricks = notAllowed` | 1. Seed saved state. 2. Render bond page. | `cutBricks` is automatically reset to `allowed`. | Passed |
| TC-BP-005 | Navigate to cost page when bond form is valid | `BondPage.tsx` | Page rendered with a `/cost` route target | Default valid bond state | 1. Open bond page. 2. Click next. | Router navigates to the cost step. | Passed |

## Notes

- The automated suite currently covers unit tests for `brickDimensions.ts` and `stack.ts`, plus interaction tests for `FormContext`, `DimensionsPage`, and `BondPage`.
- Bond-specific layout tests for the remaining bond pattern files can be added later using the same structure.

## Non-Functional and Robustness Test Cases

| Test Case ID | Title | Module | Preconditions | Test Data | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-NF-001 | Handle extremely large fence length input without crashing | `DimensionsPage.tsx` / rendering flow | Application is running in a browser | `Fence Length = 1000`, valid wall height such as `1.8` | 1. Open the dimensions page. 2. Enter `1000` into Fence Length (meters). 3. Enter a valid Fence Height. 4. Observe browser responsiveness and page behavior. | The application should remain responsive, avoid browser crash/freezing, and either render safely, reject the value, or show a validation warning/message. | Planned |

## Brick Quantity Calculation and Price Validation

---

# 测试用例（中文版）

## 文档信息

- 项目名称：Fence Calculator
- 测试范围：砖块尺寸校验、stack bond 生成、表单状态管理与页面交互测试
- 编写者：Testing team
- 最后更新：2026-05-09
- 测试级别：单元测试、组件测试
- 测试框架：Vitest、Testing Library

## 测试用例格式

每条测试用例使用以下字段：

| 字段 | 说明 |
| --- | --- |
| Test Case ID | 测试用例唯一编号 |
| Title | 测试标题 |
| Module | 被测文件或函数 |
| Preconditions | 执行前置条件 |
| Test Data | 测试输入数据 |
| Steps | 执行步骤 |
| Expected Result | 预期结果 |
| Status | 状态：Planned、Passed、Failed、Blocked |

## 单元测试用例

| Test Case ID | Title | Module | Preconditions | Test Data | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-BD-001 | 校验默认砖块尺寸 | `validateBrickDimensions()` | 已安装测试环境 | 默认砖块尺寸 | 1. 使用默认值调用函数。 | 函数返回 `true`。 | Passed |
| TC-BD-002 | 当宽度低于最小值时拒绝通过 | `validateBrickDimensions()` | 已安装测试环境 | `width = MIN_BRICK_WIDTH - 1` | 1. 使用低于最小值的宽度调用函数。 | 函数返回 `false`。 | Passed |
| TC-BD-003 | 当长度公式错误时拒绝通过 | `validateBrickDimensions()` | 已安装测试环境 | `length != width * 2 + mortar` | 1. 使用不满足公式的长度调用函数。 | 函数返回 `false`。 | Passed |
| TC-BD-004 | 当高度为非正数时拒绝通过 | `validateBrickDimensions()` | 已安装测试环境 | `height = 0` | 1. 将高度设为 `0` 后调用函数。 | 函数返回 `false`。 | Passed |
| TC-BD-005 | 当灰缝为非正数时拒绝通过 | `validateBrickDimensions()` | 已安装测试环境 | `mortar = 0` | 1. 将灰缝设为 `0` 后调用函数。 | 函数返回 `false`。 | Passed |
| TC-BD-006 | 在 custom 模式下解析数字字符串 | `brickDimensionsFromStrings()` | 已安装测试环境 | `"230"`、`"110"`、`"76"`、`"10"` | 1. 在 `custom` 模式下调用函数。 | 返回对象中的字段被正确解析为数字。 | Passed |
| TC-BD-007 | 非 custom 模式下使用默认尺寸 | `brickDimensionsFromStrings()` | 已安装测试环境 | `brickSizeMode = default` | 1. 在非 `custom` 模式下调用函数。 | 返回默认砖块尺寸。 | Passed |
| TC-BD-008 | 空字符串输入时回退默认值 | `brickDimensionsFromStrings()` | 已安装测试环境 | 空字符串 | 1. 在 `custom` 模式下传入空字符串。 | 返回默认砖块尺寸。 | Passed |
| TC-BD-009 | 非法字符串输入时回退默认值 | `brickDimensionsFromStrings()` | 已安装测试环境 | `"abc"` 等非法字符串 | 1. 在 `custom` 模式下传入非法字符串。 | 返回默认砖块尺寸。 | Passed |
| TC-BD-010 | 解析小数和带空格的字符串 | `brickDimensionsFromStrings()` | 已安装测试环境 | `" 230.5 "`、`"110.25"`、`"76.75"`、`"10.5"` | 1. 在 `custom` 模式下传入小数与带空格的值。 | 返回对象正确解析为小数。 | Passed |
| TC-BD-011 | 仅对部分非法字段进行回退 | `brickDimensionsFromStrings()` | 已安装测试环境 | 单个非法字段，如 `brickWidth = "abc"` | 1. 在 `custom` 模式下传入一个非法字段和其他合法字段。 | 只有非法字段回退到默认值。 | Passed |
| TC-BD-012 | `"0"` 字符串输入时回退默认值 | `brickDimensionsFromStrings()` | 已安装测试环境 | 所有自定义字段都为 `"0"` | 1. 在 `custom` 模式下传入 `"0"`。 | 因解析后为 falsy，返回默认砖块尺寸。 | Passed |
| TC-BD-013 | 在校验前保留负数字段 | `brickDimensionsFromStrings()` | 已安装测试环境 | 负数字符串 | 1. 在 `custom` 模式下传入负数字符串。 | 返回对象保留负数，交由后续校验逻辑处理。 | Passed |
| TC-ST-001 | 生成 stack bond 的结果结构 | `stackBond.generate()` | 已安装测试环境 | `wallL = 1.0 m`、`wallH = 0.5 m`、默认尺寸 | 1. 使用常规墙体数据调用生成器。 | 返回结果包含 `bricks`、`brickCount`、`nRows`、`wallW`、`wallH`、`adjPieceLength` 和 `snapped`。 | Passed |
| TC-ST-002 | 验证砖块列表非空 | `stackBond.generate()` | 已安装测试环境 | `wallL = 1.0 m`、`wallH = 0.5 m`、默认尺寸 | 1. 使用常规墙体数据调用生成器。 | `bricks.length > 0`。 | Passed |
| TC-ST-003 | 验证行数为正数 | `stackBond.generate()` | 已安装测试环境 | `wallL = 1.0 m`、`wallH = 0.5 m`、默认尺寸 | 1. 使用常规墙体数据调用生成器。 | `nRows > 0`。 | Passed |
| TC-ST-004 | 验证砖块几何数据非负 | `stackBond.generate()` | 已安装测试环境 | `wallL = 1.0 m`、`wallH = 0.5 m`、默认尺寸 | 1. 使用常规墙体数据调用生成器。2. 检查每块砖。 | 每块砖的 `x`、`y`、`w`、`h` 都不为负数。 | Passed |
| TC-ST-005 | 验证砖块类型合法 | `stackBond.generate()` | 已安装测试环境 | `wallL = 1.0 m`、`wallH = 0.5 m`、默认尺寸 | 1. 使用常规墙体数据调用生成器。2. 检查每块砖的类型。 | 每块砖类型都属于 `full`、`half` 或 `adj`。 | Passed |
| TC-ST-006 | 小尺寸墙体也能安全处理 | `stackBond.generate()` | 已安装测试环境 | `wallL = 0.04 m`、`wallH = 0.04 m`、默认尺寸 | 1. 使用小墙体调用生成器。 | 函数返回合法结构，且没有负数几何数据。 | Passed |
| TC-ST-007 | 验证墙高计算公式 | `stackBond.generate()` | 已安装测试环境 | `wallL = 1.0 m`、`wallH = 0.5 m`、默认尺寸 | 1. 调用生成器。2. 计算 `nRows * (height + mortar) - mortar`。 | `wallH` 与公式结果完全一致。 | Passed |
| TC-ST-008 | 零长度墙体也能安全处理 | `stackBond.generate()` | 已安装测试环境 | `wallL = 0 m`、`wallH = 0.04 m`、默认尺寸 | 1. 使用零长度墙体调用生成器。 | 返回结果 `wallW = 0`、没有砖块且没有负值。 | Passed |
| TC-ST-009 | 按当前行数规则处理零高度墙体 | `stackBond.generate()` | 已安装测试环境 | `wallL = 1.0 m`、`wallH = 0 m`、默认尺寸 | 1. 使用零高度墙体调用生成器。 | 返回结果符合当前公式逻辑，且结构仍然有效。 | Passed |

## 组件与交互测试用例

| Test Case ID | Title | Module | Preconditions | Test Data | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-FC-001 | 加载默认表单状态 | `FormProvider` | `localStorage` 为空且 cookie 同意存储 | 无保存状态 | 1. 在 `FormProvider` 中渲染一个 consumer。 | 能读取到默认值，例如 `bondPattern = stretcher`。 | Passed |
| TC-FC-002 | 加载已保存的表单状态 | `FormProvider` | cookie 同意存储 | `localStorage` 中保存的自定义状态 | 1. 预先写入 `localStorage`。2. 渲染 `FormProvider`。 | context 状态会加载保存的数据。 | Passed |
| TC-FC-003 | 禁止存储时忽略已保存状态 | `FormProvider` | cookie 禁止存储 | `localStorage` 中保存的状态 | 1. 预先写入 `localStorage`。2. 设置 `CookieConsent=false`。3. 渲染 `FormProvider`。 | context 回退到默认状态。 | Passed |
| TC-FC-004 | 持久化表单更新 | `FormProvider` | cookie 同意存储 | 派发 `SET_FIELD` 动作 | 1. 渲染 `FormProvider`。2. 通过 context 更新字段。 | 更新后的状态会写入 `localStorage`。 | Passed |
| TC-FC-005 | 重置表单状态 | `FormProvider` | cookie 同意存储 | 派发 `RESET` 动作 | 1. 渲染 `FormProvider`。2. 修改字段。3. 执行 reset。 | context 恢复为默认值。 | Passed |
| TC-DP-001 | 在尺寸合法前禁用下一步按钮 | `DimensionsPage.tsx` | 页面在 router 和 provider 中渲染 | 空的 length 和 height | 1. 打开 dimensions 页面。2. 检查下一步按钮。3. 输入合法墙长和墙高。 | 下一步按钮初始为禁用，输入合法值后变为可用。 | Passed |
| TC-DP-002 | 当墙高超限时阻止继续 | `DimensionsPage.tsx` | 页面在 router 和 provider 中渲染 | `height > 2` | 1. 输入合法长度。2. 输入超过最大值的高度。 | 显示高度错误、隐藏预览，且下一步保持禁用。 | Passed |
| TC-DP-003 | 自定义砖宽时自动更新砖长 | `DimensionsPage.tsx` | 页面在 router 和 provider 中渲染 | 自定义砖宽数值 | 1. 切换到 custom brick 模式。2. 修改砖宽。 | 砖长自动更新为 `width * 2 + mortar`。 | Passed |
| TC-DP-004 | 尺寸合法时跳转到 bond 页面 | `DimensionsPage.tsx` | 页面带有 `/bond` 路由目标 | 合法墙长和墙高 | 1. 输入合法尺寸。2. 点击下一步。 | 路由跳转到 bond 步骤页面。 | Passed |
| TC-BP-001 | 选择 pier 类型后显示相关控件 | `BondPage.tsx` | 页面在 router 和 provider 中渲染 | `pierType = hidden` | 1. 打开 bond 页面。2. 选择 hidden pier。 | 显示 pier size、height、spacing 和 infill 控件。 | Passed |
| TC-BP-002 | stack bond 下禁用不支持的 hidden pier 尺寸 | `BondPage.tsx` | 页面在 router 和 provider 中渲染 | `bondPattern = stack`、`pierType = hidden` | 1. 选择 stack bond。2. 选择 hidden pier。 | 不支持的 pier size 被禁用，支持的尺寸保持可选。 | Passed |
| TC-BP-003 | 当 pier spacing 过大时阻止继续 | `BondPage.tsx` | 页面在 router 和 provider 中渲染 | `pierSpacing > 3` | 1. 选择 pier 类型。2. 输入超过最大值的 spacing。 | 显示 spacing 错误、隐藏预览，且下一步被禁用。 | Passed |
| TC-BP-004 | 当前 bond 不支持 no-cut 时重置 cut-brick 模式 | `BondPage.tsx` | 页面带有保存状态 | 保存状态中 `bondPattern = english` 且 `cutBricks = notAllowed` | 1. 预设保存状态。2. 渲染 bond 页面。 | `cutBricks` 会自动重置为 `allowed`。 | Passed |
| TC-BP-005 | bond 表单合法时跳转到 cost 页面 | `BondPage.tsx` | 页面带有 `/cost` 路由目标 | 默认合法的 bond 状态 | 1. 打开 bond 页面。2. 点击下一步。 | 路由跳转到 cost 步骤页面。 | Passed |

## 说明

- 当前自动化测试已经覆盖 `brickDimensions.ts`、`stack.ts` 的单元测试，以及 `FormContext`、`DimensionsPage`、`BondPage` 的交互测试。
- 其余 bond pattern 文件后续可以沿用相同结构继续补充测试。

## 非功能与健壮性测试用例

| Test Case ID | Title | Module | Preconditions | Test Data | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-NF-001 | 超大围栏长度输入时应用不应崩溃 | `DimensionsPage.tsx` / 渲染流程 | 应用已在浏览器中运行 | `Fence Length = 1000`，合法墙高如 `1.8` | 1. 打开 dimensions 页面。 2. 在 Fence Length (meters) 中输入 `1000`。 3. 输入一个合法的 Fence Height。 4. 观察浏览器响应和页面表现。 | 应用应保持可响应，不应导致浏览器崩溃或长时间卡死；系统应安全渲染、拒绝该值，或显示对应的校验/警告信息。 | Planned |

## 砖块数量计算与价格验证
