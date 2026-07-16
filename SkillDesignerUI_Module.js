(function () {
  'use strict';

  const API_VERSION = 1;
  const instances = new Map();
  let instanceSeed = 0;

  function resolveVue() {
    const candidates = [globalThis];
    try {
      if (window.parent && window.parent !== window) candidates.push(window.parent);
    } catch (error) {}
    try {
      if (window.top && window.top !== window && !candidates.includes(window.top)) candidates.push(window.top);
    } catch (error) {}
    for (const candidate of candidates) {
      if (candidate && candidate.Vue && typeof candidate.Vue.createApp === 'function') return candidate.Vue;
    }
    return null;
  }

  function cloneValue(value) {
    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(value);
      } catch (error) {}
    }
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function normalizeText(value, fallback = '') {
    const text = value === undefined || value === null ? '' : String(value).trim();
    return text || fallback;
  }

  function normalizeOptions(options) {
    const result = [];
    (Array.isArray(options) ? options : []).forEach((entry, groupIndex) => {
      if (entry && typeof entry === 'object' && Array.isArray(entry.options)) {
        entry.options.forEach((option, optionIndex) => {
          const value = option && typeof option === 'object' ? option.value : option;
          const label = option && typeof option === 'object' ? option.label : option;
          if (value === undefined || value === null || String(value) === '') return;
          result.push({
            value,
            label: normalizeText(label, String(value)),
            description: normalizeText(option && typeof option === 'object' ? option.description : '', ''),
            group: normalizeText(entry.label, `分组${groupIndex + 1}`),
            id: `g${groupIndex}-o${optionIndex}`,
          });
        });
        return;
      }
      const value = entry && typeof entry === 'object' ? entry.value : entry;
      const label = entry && typeof entry === 'object' ? entry.label : entry;
      const group = entry && typeof entry === 'object' ? entry.group : '';
      const id = entry && typeof entry === 'object' ? entry.id : '';
      const description = entry && typeof entry === 'object' ? entry.description : '';
      if (value === undefined || value === null || String(value) === '') return;
      result.push({
        value,
        label: normalizeText(label, String(value)),
        description: normalizeText(description, ''),
        group: normalizeText(group, ''),
        id: normalizeText(id, `o${result.length}`),
      });
    });
    return result;
  }

  function pathKey(path) {
    return (Array.isArray(path) ? path : []).map(segment => String(segment)).join('.');
  }

  function getAtPath(root, path) {
    return (Array.isArray(path) ? path : []).reduce(
      (value, segment) => (value && typeof value === 'object' ? value[segment] : undefined),
      root,
    );
  }

  function setAtPath(root, path, value) {
    const segments = Array.isArray(path) ? path : [];
    if (!segments.length) return;
    let cursor = root;
    for (let index = 0; index < segments.length - 1; index += 1) {
      const segment = segments[index];
      const nextSegment = segments[index + 1];
      if (!cursor[segment] || typeof cursor[segment] !== 'object') {
        cursor[segment] = typeof nextSegment === 'number' ? [] : {};
      }
      cursor = cursor[segment];
    }
    cursor[segments[segments.length - 1]] = value;
  }

  function replaceReactiveObject(target, nextValue) {
    Object.keys(target).forEach(key => {
      delete target[key];
    });
    Object.assign(target, cloneValue(nextValue) || {});
  }

  function createComponents(Vue) {
    const {
      Teleport,
      computed,
      defineComponent,
      h,
      nextTick,
      onBeforeUnmount,
      onMounted,
      reactive,
      shallowRef,
      watch,
    } = Vue;

    const SkillCombobox = defineComponent({
      name: 'SkillCombobox',
      props: {
        modelValue: { default: '' },
        options: { type: Array, default: () => [] },
        disabled: Boolean,
        label: { type: String, default: '选项' },
        instanceId: { type: String, required: true },
      },
      emits: ['update:modelValue'],
      setup(props, { emit }) {
        const open = shallowRef(false);
        const query = shallowRef('');
        const activeIndex = shallowRef(0);
        const trigger = shallowRef(null);
        const searchInput = shallowRef(null);
        const popupStyle = shallowRef({});
        const flatOptions = computed(() => normalizeOptions(props.options));
        const filteredOptions = computed(() => {
          const keyword = normalizeText(query.value, '').toLocaleLowerCase();
          if (!keyword) return flatOptions.value;
          return flatOptions.value.filter(
            option =>
              String(option.label).toLocaleLowerCase().includes(keyword) ||
              String(option.description).toLocaleLowerCase().includes(keyword) ||
              String(option.value).toLocaleLowerCase().includes(keyword) ||
              String(option.group).toLocaleLowerCase().includes(keyword),
          );
        });
        const selectedLabel = computed(() => {
          const selected = flatOptions.value.find(option => String(option.value) === String(props.modelValue));
          return selected ? selected.label : normalizeText(props.modelValue, '请选择');
        });
        const listboxId = `${props.instanceId}-listbox`;
        const activeDescendant = computed(() => {
          const option = filteredOptions.value[activeIndex.value];
          return option ? `${listboxId}-${option.id}` : '';
        });
        let unmounted = false;
        let openListenersBound = false;

        function scrollActiveIntoView() {
          const activeId = activeDescendant.value;
          if (!activeId) return;
          document.getElementById(activeId)?.scrollIntoView?.({ block: 'nearest' });
        }

        function updatePosition() {
          if (!trigger.value || !open.value) return;
          const rect = trigger.value.getBoundingClientRect();
          const viewportWidth = Math.max(240, window.innerWidth);
          const viewportHeight = Math.max(320, window.innerHeight);
          const width = Math.min(Math.max(220, rect.width), viewportWidth - 16);
          const left = Math.min(Math.max(8, rect.left), Math.max(8, viewportWidth - width - 8));
          const below = viewportHeight - rect.bottom - 12;
          const above = rect.top - 12;
          const openUpward = below < 220 && above > below;
          const maxHeight = Math.max(160, Math.min(360, openUpward ? above : below));
          const top = openUpward
            ? Math.max(8, rect.top - maxHeight - 6)
            : Math.min(viewportHeight - 80, rect.bottom + 6);
          popupStyle.value = {
            position: 'fixed',
            left: `${left}px`,
            top: `${top}px`,
            width: `${width}px`,
            maxHeight: `${maxHeight}px`,
            zIndex: 100000,
          };
        }

        function handleOutsidePointer(event) {
          const popup = document.getElementById(`${props.instanceId}-popup`);
          if (trigger.value?.contains(event.target) || popup?.contains(event.target)) return;
          close(false);
        }

        function bindOpenListeners() {
          if (unmounted || openListenersBound) return;
          window.addEventListener('resize', updatePosition);
          window.addEventListener('scroll', updatePosition, true);
          document.addEventListener('pointerdown', handleOutsidePointer, true);
          openListenersBound = true;
        }

        function unbindOpenListeners() {
          if (!openListenersBound) return;
          window.removeEventListener('resize', updatePosition);
          window.removeEventListener('scroll', updatePosition, true);
          document.removeEventListener('pointerdown', handleOutsidePointer, true);
          openListenersBound = false;
        }

        function show() {
          if (props.disabled || open.value) return;
          open.value = true;
          query.value = '';
          activeIndex.value = Math.max(
            0,
            flatOptions.value.findIndex(option => String(option.value) === String(props.modelValue)),
          );
          nextTick(() => {
            if (unmounted || !open.value) return;
            updatePosition();
            bindOpenListeners();
            searchInput.value?.focus();
            scrollActiveIntoView();
          });
        }

        function close(returnFocus = true) {
          if (!open.value) return;
          open.value = false;
          unbindOpenListeners();
          if (returnFocus) nextTick(() => trigger.value?.focus());
        }

        function select(option) {
          if (!option) return;
          emit('update:modelValue', option.value);
          close();
        }

        function handleKeydown(event) {
          if (!open.value && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
            event.preventDefault();
            show();
            return;
          }
          if (!open.value) return;
          if (event.key === 'Escape') {
            event.preventDefault();
            close();
            return;
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const direction = event.key === 'ArrowDown' ? 1 : -1;
            const count = filteredOptions.value.length;
            if (count) {
              activeIndex.value = (activeIndex.value + direction + count) % count;
              nextTick(scrollActiveIntoView);
            }
            return;
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            select(filteredOptions.value[activeIndex.value]);
          }
        }

        watch(query, () => {
          activeIndex.value = 0;
        });
        onBeforeUnmount(() => {
          unmounted = true;
          unbindOpenListeners();
        });

        return {
          activeDescendant,
          activeIndex,
          close,
          filteredOptions,
          handleKeydown,
          listboxId,
          open,
          popupStyle,
          query,
          searchInput,
          select,
          selectedLabel,
          show,
          scrollActiveIntoView,
          trigger,
        };
      },
      template: `
        <div class="skill-designer-vue-combobox">
          <button
            ref="trigger"
            type="button"
            class="skill-designer-vue-control skill-designer-vue-combobox-trigger"
            :disabled="disabled"
            :aria-label="label + '：' + selectedLabel"
            :aria-expanded="open ? 'true' : 'false'"
            :aria-controls="listboxId"
            aria-haspopup="listbox"
            @click="open ? close() : show()"
            @keydown="handleKeydown"
          >
            <span>{{ selectedLabel }}</span>
            <i class="fa-solid fa-chevron-down skill-designer-vue-chevron" aria-hidden="true"></i>
          </button>
          <Teleport to="body">
            <div
              v-if="open"
              :id="instanceId + '-popup'"
              class="skill-designer-vue-popover"
              :style="popupStyle"
            >
              <input
                ref="searchInput"
                v-model="query"
                class="skill-designer-vue-control skill-designer-vue-search"
                type="search"
                name="skill-designer-search"
                autocomplete="off"
                :placeholder="'搜索' + label"
                :aria-label="'搜索' + label"
                :aria-controls="listboxId"
                :aria-activedescendant="activeDescendant"
                aria-autocomplete="list"
                :aria-expanded="open ? 'true' : 'false'"
                role="combobox"
                @keydown="handleKeydown"
              />
              <div :id="listboxId" class="skill-designer-vue-option-list" role="listbox">
                <button
                  v-for="(option, index) in filteredOptions"
                  :id="listboxId + '-' + option.id"
                  :key="option.id + '-' + String(option.value)"
                  type="button"
                  class="skill-designer-vue-option"
                  :class="{ active: index === activeIndex, selected: String(option.value) === String(modelValue) }"
                  :title="option.description ? option.label + '：' + option.description : option.label"
                  role="option"
                  :aria-selected="String(option.value) === String(modelValue) ? 'true' : 'false'"
                  @pointermove="activeIndex = index"
                  @click="select(option)"
                >
                  <small
                    v-if="option.group && (index === 0 || filteredOptions[index - 1]?.group !== option.group)"
                    class="skill-designer-vue-option-group"
                  >{{ option.group }}</small>
                  <span class="skill-designer-vue-option-title">{{ option.label }}</span>
                  <span v-if="option.description" class="skill-designer-vue-option-description">{{ option.description }}</span>
                </button>
                <div v-if="!filteredOptions.length" class="skill-designer-vue-empty">没有匹配项</div>
              </div>
            </div>
          </Teleport>
        </div>
      `,
    });

    const SkillMultiSelect = defineComponent({
      name: 'SkillMultiSelect',
      components: { SkillCombobox },
      props: {
        modelValue: { type: Array, default: () => [] },
        options: { type: Array, default: () => [] },
        disabled: Boolean,
        label: { type: String, default: '选项' },
        instanceId: { type: String, required: true },
      },
      emits: ['update:modelValue'],
      setup(props, { emit }) {
        const available = computed(() => {
          const selected = new Set((props.modelValue || []).map(value => String(value)));
          return normalizeOptions(props.options).filter(option => !selected.has(String(option.value)));
        });
        const selectedItems = computed(() => {
          const labels = new Map(
            normalizeOptions(props.options).map(option => [String(option.value), option.label]),
          );
          return (props.modelValue || []).map(value => ({
            value,
            label: labels.get(String(value)) || String(value),
          }));
        });
        function add(value) {
          if (value === '' || value === undefined || value === null) return;
          emit('update:modelValue', [...(props.modelValue || []), value]);
        }
        function remove(value) {
          emit(
            'update:modelValue',
            (props.modelValue || []).filter(item => String(item) !== String(value)),
          );
        }
        return { add, available, remove, selectedItems };
      },
      template: `
        <div class="skill-designer-vue-multiselect">
          <div class="skill-designer-vue-token-list" aria-live="polite">
            <span v-for="item in selectedItems" :key="String(item.value)" class="skill-designer-vue-token">
              {{ item.label }}
              <button type="button" :disabled="disabled" :aria-label="'移除' + item.label" @click="remove(item.value)">
                <i class="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            </span>
          </div>
          <SkillCombobox
            v-if="available.length"
            :model-value="''"
            :options="available"
            :disabled="disabled"
            :label="label"
            :instance-id="instanceId + '-add'"
            @update:model-value="add"
          />
          <div v-else-if="!modelValue.length" class="skill-designer-vue-empty-inline">暂无可选项</div>
        </div>
      `,
    });

    const SkillMatcherObject = defineComponent({
      name: 'SkillMatcherObject',
      components: { SkillCombobox, SkillMultiSelect },
      props: {
        modelValue: { type: Object, default: () => ({}) },
        descriptor: { type: Object, required: true },
        disabled: Boolean,
        instanceId: { type: String, required: true },
      },
      emits: ['update:modelValue'],
      setup(props, { emit }) {
        const matcherModel = computed(() =>
          typeof props.descriptor.getMatcherModel === 'function'
            ? props.descriptor.getMatcherModel(props.modelValue || {})
            : { fields: [] },
        );
        function patch(key, value) {
          emit('update:modelValue', { ...(props.modelValue || {}), [key]: value });
        }
        return { matcherModel, patch };
      },
      template: `
        <div class="skill-designer-vue-matcher">
          <div v-for="field in matcherModel.fields" :key="field.key" class="skill-designer-vue-field">
            <span class="skill-designer-vue-label">{{ field.label }}</span>
            <SkillMultiSelect
              v-if="field.control === 'multiEnum'"
              :model-value="Array.isArray(modelValue[field.key]) ? modelValue[field.key] : modelValue[field.key] ? [modelValue[field.key]] : []"
              :options="field.options"
              :disabled="disabled"
              :label="field.label"
              :instance-id="instanceId + '-' + field.key"
              @update:model-value="patch(field.key, $event)"
            />
            <SkillCombobox
              v-else-if="field.control === 'singleEnum'"
              :model-value="modelValue[field.key] || ''"
              :options="field.options"
              :disabled="disabled"
              :label="field.label"
              :instance-id="instanceId + '-' + field.key"
              @update:model-value="patch(field.key, $event)"
            />
            <input
              v-else
              class="skill-designer-vue-control"
              type="text"
              :name="field.key"
              autocomplete="off"
              :value="modelValue[field.key] || ''"
              :disabled="disabled"
              :aria-label="field.label"
              @input="patch(field.key, $event.target.value)"
            />
          </div>
        </div>
      `,
    });

    const SkillFieldControl = defineComponent({
      name: 'SkillFieldControl',
      components: { SkillCombobox, SkillMatcherObject, SkillMultiSelect },
      props: {
        descriptor: { type: Object, required: true },
        modelValue: { default: '' },
        disabled: Boolean,
        instanceId: { type: String, required: true },
      },
      emits: ['update:modelValue'],
      setup(props, { emit }) {
        function update(value) {
          emit('update:modelValue', value);
        }
        function updateInput(event) {
          update(event.target.value);
        }
        return { update, updateInput };
      },
      template: `
        <div class="skill-designer-vue-field-control">
          <div v-if="descriptor.control === 'static'" class="skill-designer-vue-static">{{ modelValue }}</div>
          <label v-else-if="descriptor.control === 'toggle'" class="skill-designer-vue-toggle">
            <input
              type="checkbox"
              :name="descriptor.key || descriptor.label"
              :checked="modelValue === true || modelValue === '启用'"
              :disabled="disabled"
              :aria-label="descriptor.label"
              @change="update($event.target.checked ? (descriptor.trueValue ?? '启用') : (descriptor.falseValue ?? '无'))"
            />
            <span aria-hidden="true"></span>
          </label>
          <div v-else-if="descriptor.control === 'segmented'" class="skill-designer-vue-segmented" role="group">
            <button
              v-for="option in descriptor.options"
              :key="String(option.value ?? option)"
              type="button"
              :class="{ active: String(modelValue) === String(option.value ?? option) }"
              :disabled="disabled"
              @click="update(option.value ?? option)"
            >
              {{ option.label ?? option }}
            </button>
          </div>
          <SkillCombobox
            v-else-if="descriptor.control === 'singleEnum'"
            :model-value="modelValue"
            :options="descriptor.options"
            :disabled="disabled"
            :label="descriptor.label"
            :instance-id="instanceId"
            @update:model-value="update"
          />
          <SkillMultiSelect
            v-else-if="descriptor.control === 'multiEnum'"
            :model-value="Array.isArray(modelValue) ? modelValue : modelValue ? String(modelValue).split(/[、,，|/]/).filter(Boolean) : []"
            :options="descriptor.options"
            :disabled="disabled"
            :label="descriptor.label"
            :instance-id="instanceId"
            @update:model-value="update"
          />
          <SkillMatcherObject
            v-else-if="descriptor.control === 'matcherObject'"
            :model-value="modelValue && typeof modelValue === 'object' ? modelValue : {}"
            :descriptor="descriptor"
            :disabled="disabled"
            :instance-id="instanceId"
            @update:model-value="update"
          />
          <textarea
            v-else-if="descriptor.control === 'textarea'"
            class="skill-designer-vue-control skill-designer-vue-textarea"
            :name="descriptor.key || descriptor.label"
            autocomplete="off"
            :value="modelValue"
            :placeholder="descriptor.placeholder || ''"
            :disabled="disabled"
            :aria-label="descriptor.label"
            @input="updateInput"
          ></textarea>
          <input
            v-else
            class="skill-designer-vue-control"
            type="text"
            :name="descriptor.key || descriptor.label"
            autocomplete="off"
            :inputmode="descriptor.control === 'number' || descriptor.control === 'duration' ? 'numeric' : descriptor.control === 'numberOrPercent' ? 'decimal' : 'text'"
            :value="modelValue"
            :placeholder="descriptor.placeholder || ''"
            :disabled="disabled"
            :aria-label="descriptor.label"
            :aria-invalid="descriptor.invalid ? 'true' : 'false'"
            @input="updateInput"
          />
        </div>
      `,
    });

    const SkillConditionBuilder = defineComponent({
      name: 'SkillConditionBuilder',
      components: { SkillCombobox, SkillFieldControl },
      props: {
        branches: { type: Array, default: () => [] },
        path: { type: Array, required: true },
        disabled: Boolean,
        depth: { type: Number, default: 0 },
        modelApi: { type: Object, required: true },
        instanceId: { type: String, required: true },
        objectKey: { type: Function, required: true },
      },
      emits: ['patch', 'structure'],
      setup(props, { emit }) {
        function branchPath(index, key) {
          return [...props.path, index, key];
        }
        function conditionPath(branchIndex, conditionIndex, key) {
          return [...props.path, branchIndex, '条件', conditionIndex, key];
        }
        function conditionModel(condition) {
          return props.modelApi.getConditionModel(condition || {});
        }
        return { branchPath, conditionModel, conditionPath, emit };
      },
      template: `
        <div class="skill-designer-vue-condition-builder">
          <div
            v-for="(branch, branchIndex) in branches"
            :key="objectKey(branch, 'branch')"
            class="skill-designer-vue-condition-branch"
          >
            <div class="skill-designer-vue-row-head">
              <strong>条件 {{ branchIndex + 1 }}</strong>
              <button
                type="button"
                class="skill-designer-vue-icon-button danger"
                :disabled="disabled"
                aria-label="删除条件分支"
                title="删除条件分支"
                @click="emit('structure', { type: 'remove', path, index: branchIndex })"
              ><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
            </div>
            <div class="skill-designer-vue-condition-list">
              <div
                v-for="(condition, conditionIndex) in branch.条件 || []"
                :key="objectKey(condition, 'condition')"
                class="skill-designer-vue-condition-row"
                :class="{ 'has-remove-action': (branch.条件 || []).length > 1 }"
              >
                <SkillCombobox
                  :model-value="condition.类型"
                  :options="modelApi.conditionTypeOptions"
                  :disabled="disabled"
                  label="条件类型"
                  :instance-id="instanceId + '-type-' + branchIndex + '-' + conditionIndex"
                  @update:model-value="emit('patch', { path: conditionPath(branchIndex, conditionIndex, '类型'), value: $event, dependent: true })"
                />
                <SkillCombobox
                  :model-value="condition.对象 || '目标'"
                  :options="modelApi.conditionObjectOptions"
                  :disabled="disabled"
                  label="条件对象"
                  :instance-id="instanceId + '-object-' + branchIndex + '-' + conditionIndex"
                  @update:model-value="emit('patch', { path: conditionPath(branchIndex, conditionIndex, '对象'), value: $event })"
                />
                <div v-if="conditionModel(condition).showCompare" class="skill-designer-vue-operator-group">
                  <button
                    v-for="operator in conditionModel(condition).compareOptions"
                    :key="operator"
                    type="button"
                    :class="{ active: operator === condition.比较 }"
                    :disabled="disabled"
                    @click="emit('patch', { path: conditionPath(branchIndex, conditionIndex, '比较'), value: operator, dependent: true })"
                  >{{ operator }}</button>
                </div>
                <SkillFieldControl
                  v-if="conditionModel(condition).valueField"
                  :descriptor="conditionModel(condition).valueField"
                  :model-value="condition[conditionModel(condition).valueField.key] || ''"
                  :disabled="disabled"
                  :instance-id="instanceId + '-value-' + branchIndex + '-' + conditionIndex"
                  @update:model-value="emit('patch', { path: conditionPath(branchIndex, conditionIndex, conditionModel(condition).valueField.key), value: $event })"
                />
                <button
                  v-if="(branch.条件 || []).length > 1"
                  type="button"
                  class="skill-designer-vue-icon-button"
                  :disabled="disabled"
                  aria-label="删除判定条件"
                  title="删除判定条件"
                  @click="emit('structure', { type: 'remove', path: branchPath(branchIndex, '条件'), index: conditionIndex })"
                ><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
              </div>
            </div>
            <button
              type="button"
              class="skill-designer-vue-text-button"
              :disabled="disabled"
              @click="emit('structure', { type: 'add-condition', path: branchPath(branchIndex, '条件') })"
            >+ 判定</button>
            <div class="skill-designer-vue-condition-action">
              <span class="skill-designer-vue-label">满足后</span>
              <div class="skill-designer-vue-segmented compact">
                <button
                  v-for="action in modelApi.conditionActionOptions"
                  :key="action"
                  type="button"
                  :class="{ active: action === branch.处理 }"
                  :disabled="disabled"
                  @click="emit('patch', { path: branchPath(branchIndex, '处理'), value: action, dependent: true })"
                >{{ action }}</button>
              </div>
            </div>
            <SkillPrototypeList
              v-if="branch.处理 === '替换效果' || branch.处理 === '追加效果'"
              :effects="branch[branch.处理] || []"
              :path="branchPath(branchIndex, branch.处理)"
              :disabled="disabled"
              :depth="depth + 1"
              :model-api="modelApi"
              :instance-id="instanceId + '-effects-' + branchIndex"
              :object-key="objectKey"
              :allow-empty="false"
              @patch="emit('patch', $event)"
              @structure="emit('structure', $event)"
            />
          </div>
          <button
            type="button"
            class="skill-designer-vue-text-button"
            :disabled="disabled || branches.length >= 3"
            :title="branches.length >= 3 ? '单个原型最多 3 个条件分支' : '新增条件分支'"
            @click="emit('structure', { type: 'add-branch', path })"
          >+ 条件分支</button>
          <span v-if="branches.length >= 3" class="skill-designer-vue-limit-note">已达到 3 个分支上限</span>
        </div>
      `,
    });

    const SkillPrototypeEditor = defineComponent({
      name: 'SkillPrototypeEditor',
      components: { SkillCombobox, SkillConditionBuilder, SkillFieldControl },
      props: {
        effect: { type: Object, required: true },
        path: { type: Array, required: true },
        index: { type: Number, required: true },
        count: { type: Number, required: true },
        disabled: Boolean,
        depth: { type: Number, default: 0 },
        modelApi: { type: Object, required: true },
        instanceId: { type: String, required: true },
        objectKey: { type: Function, required: true },
        allowEmpty: Boolean,
      },
      emits: ['patch', 'structure'],
      setup(props, { emit }) {
        const model = computed(() => props.modelApi.getPrototypeModel(props.effect, { depth: props.depth }));
        function fieldPath(key) {
          return [...props.path, props.index, key];
        }
        function patchField(field, value) {
          emit('patch', {
            path: fieldPath(field.key),
            value,
            dependent: !!field.dependent,
          });
        }
        return { emit, fieldPath, model, patchField };
      },
      template: `
        <section class="skill-designer-vue-prototype" :class="{ nested: depth > 0 }">
          <div class="skill-designer-vue-prototype-head">
            <span v-if="depth > 0" class="skill-designer-vue-nested-tag">{{ effect.生效方式 === '跟随主原型' ? '附加' : '独立' }}</span>
            <SkillCombobox
              :model-value="effect.原型"
              :options="modelApi.prototypeOptions"
              :disabled="disabled"
              label="原型"
              :instance-id="instanceId + '-prototype'"
              @update:model-value="emit('patch', { path: fieldPath('原型'), value: $event, dependent: true })"
            />
            <div class="skill-designer-vue-row-actions">
              <button
                type="button"
                class="skill-designer-vue-icon-button"
                :disabled="disabled || index === 0"
                aria-label="上移原型"
                title="上移"
                @click="emit('structure', { type: 'move-up', path, index })"
              >↑</button>
              <button
                type="button"
                class="skill-designer-vue-icon-button"
                :disabled="disabled || index >= count - 1"
                aria-label="下移原型"
                title="下移"
                @click="emit('structure', { type: 'move-down', path, index })"
              >↓</button>
              <button
                type="button"
                class="skill-designer-vue-icon-button danger"
                :disabled="disabled || (!allowEmpty && count <= 1)"
                aria-label="删除原型"
                title="删除"
                @click="emit('structure', { type: 'remove', path, index })"
              ><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
            </div>
          </div>
          <p v-if="model.summary" class="skill-designer-vue-prototype-summary">{{ model.summary }}</p>
          <div class="skill-designer-vue-field-grid">
            <template v-for="field in model.fields" :key="field.key">
              <div
                v-if="field.control === 'conditionList'"
                class="skill-designer-vue-field wide"
                :data-field-path="pathKey(fieldPath(field.key))"
              >
                <div class="skill-designer-vue-label-line">
                  <span class="skill-designer-vue-label">{{ field.label }}</span>
                  <span v-if="field.help" class="skill-designer-vue-help" :title="field.help">?</span>
                </div>
                <SkillConditionBuilder
                  :branches="Array.isArray(effect[field.key]) ? effect[field.key] : []"
                  :path="fieldPath(field.key)"
                  :disabled="disabled"
                  :depth="depth"
                  :model-api="modelApi"
                  :instance-id="instanceId + '-conditions'"
                  :object-key="objectKey"
                  @patch="emit('patch', $event)"
                  @structure="emit('structure', $event)"
                />
              </div>
              <div
                v-else-if="field.control === 'effectList'"
                class="skill-designer-vue-field wide"
                :data-field-path="pathKey(fieldPath(field.key))"
              >
                <div class="skill-designer-vue-label-line">
                  <span class="skill-designer-vue-label">{{ field.label }}</span>
                  <span v-if="field.help" class="skill-designer-vue-help" :title="field.help">?</span>
                </div>
                <SkillPrototypeList
                  :effects="Array.isArray(effect[field.key]) ? effect[field.key] : []"
                  :path="fieldPath(field.key)"
                  :disabled="disabled"
                  :depth="depth + 1"
                  :model-api="modelApi"
                  :instance-id="instanceId + '-nested-' + field.key"
                  :object-key="objectKey"
                  :allow-empty="false"
                  @patch="emit('patch', $event)"
                  @structure="emit('structure', $event)"
                />
              </div>
              <div
                v-else
                class="skill-designer-vue-field"
                :class="{ wide: field.wide }"
                :data-field-path="pathKey(fieldPath(field.key))"
              >
                <span class="skill-designer-vue-label-line">
                  <span class="skill-designer-vue-label">{{ field.label }}<b v-if="field.required">*</b></span>
                  <span v-if="field.help" class="skill-designer-vue-help" :title="field.help">?</span>
                </span>
                <SkillFieldControl
                  :descriptor="field"
                  :model-value="effect[field.key] ?? field.defaultValue ?? ''"
                  :disabled="disabled"
                  :instance-id="instanceId + '-field-' + field.key"
                  @update:model-value="patchField(field, $event)"
                />
              </div>
            </template>
          </div>
        </section>
      `,
      methods: { pathKey },
    });

    const SkillPrototypeList = defineComponent({
      name: 'SkillPrototypeList',
      components: { SkillPrototypeEditor },
      props: {
        effects: { type: Array, default: () => [] },
        path: { type: Array, required: true },
        disabled: Boolean,
        depth: { type: Number, default: 0 },
        modelApi: { type: Object, required: true },
        instanceId: { type: String, required: true },
        objectKey: { type: Function, required: true },
        allowEmpty: Boolean,
      },
      emits: ['patch', 'structure'],
      setup(props, { emit }) {
        const maxDepthReached = computed(() => props.depth >= 2);
        const maxCount = computed(() =>
          props.depth > 0 ? Number(props.modelApi.nestedPrototypeLimit || 4) : Number(props.modelApi.prototypeLimit || 99),
        );
        const canAdd = computed(
          () => !maxDepthReached.value && props.effects.length < maxCount.value,
        );
        const limitReason = computed(() => {
          if (maxDepthReached.value) return '条件与嵌套效果最多 2 层';
          if (props.effects.length >= maxCount.value) return `已达到当前技能位的 ${maxCount.value} 个原型上限`;
          return '';
        });
        return { canAdd, emit, limitReason, maxCount };
      },
      template: `
        <div class="skill-designer-vue-prototype-list" :class="{ nested: depth > 0 }">
          <SkillPrototypeEditor
            v-for="(effect, index) in effects"
            :key="objectKey(effect, 'prototype')"
            :effect="effect"
            :path="path"
            :index="index"
            :count="effects.length"
            :disabled="disabled"
            :depth="depth"
            :model-api="modelApi"
            :instance-id="instanceId + '-' + objectKey(effect, 'prototype')"
            :object-key="objectKey"
            :allow-empty="allowEmpty"
            @patch="emit('patch', $event)"
            @structure="emit('structure', $event)"
          />
          <div class="skill-designer-vue-list-footer">
            <button
              type="button"
              class="skill-designer-vue-text-button"
              :disabled="disabled || !canAdd"
              :title="limitReason || '新增原型'"
              @click="emit('structure', { type: 'add-prototype', path })"
            >+ 原型</button>
            <span v-if="limitReason" class="skill-designer-vue-limit-note">{{ limitReason }}</span>
          </div>
        </div>
      `,
    });

    const SkillSideEffectList = defineComponent({
      name: 'SkillSideEffectList',
      components: { SkillFieldControl },
      props: {
        items: { type: Array, default: () => [] },
        path: { type: Array, required: true },
        disabled: Boolean,
        modelApi: { type: Object, required: true },
        instanceId: { type: String, required: true },
        objectKey: { type: Function, required: true },
      },
      emits: ['patch', 'structure'],
      setup(props, { emit }) {
        return { emit };
      },
      template: `
        <div class="skill-designer-vue-side-effects">
          <div
            v-for="(item, index) in items"
            :key="objectKey(item, 'side-effect')"
            class="skill-designer-vue-side-effect"
          >
            <div class="skill-designer-vue-row-head">
              <strong>副作用 {{ index + 1 }}</strong>
              <button
                type="button"
                class="skill-designer-vue-icon-button danger"
                :disabled="disabled"
                aria-label="删除副作用"
                title="删除副作用"
                @click="emit('structure', { type: 'remove', path, index })"
              ><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
            </div>
            <div class="skill-designer-vue-field-grid">
              <div
                v-for="field in modelApi.getSideEffectModel(item).fields"
                :key="field.key"
                class="skill-designer-vue-field"
              >
                <span class="skill-designer-vue-label">{{ field.label }}</span>
                <SkillFieldControl
                  :descriptor="field"
                  :model-value="item[field.key] ?? field.defaultValue ?? ''"
                  :disabled="disabled"
                  :instance-id="instanceId + '-' + index + '-' + field.key"
                  @update:model-value="emit('patch', { path: [...path, index, field.key], value: $event, dependent: !!field.dependent })"
                />
              </div>
            </div>
            <p class="skill-designer-vue-row-summary">{{ modelApi.getSideEffectModel(item).summary }}</p>
          </div>
          <button
            type="button"
            class="skill-designer-vue-text-button"
            :disabled="disabled"
            @click="emit('structure', { type: 'add-side-effect', path })"
          >+ 副作用</button>
        </div>
      `,
    });

    const SkillBasicPanel = defineComponent({
      name: 'SkillBasicPanel',
      components: { SkillFieldControl },
      props: {
        draft: { type: Object, required: true },
        fields: { type: Array, default: () => [] },
        disabled: Boolean,
        instanceId: { type: String, required: true },
      },
      emits: ['patch'],
      setup(props, { emit }) {
        function fieldPath(field) {
          return Array.isArray(field.path) && field.path.length ? field.path : [field.key];
        }
        function fieldValue(field) {
          const value = getAtPath(props.draft, fieldPath(field));
          return value ?? field.defaultValue ?? '';
        }
        function patch(field, value) {
          emit('patch', {
            path: fieldPath(field),
            value,
            dependent: !!field.dependent,
          });
        }
        return { fieldPath, fieldValue, patch, pathKey };
      },
      template: `
        <div class="skill-designer-vue-panel">
          <div class="skill-designer-vue-field-grid">
            <div
              v-for="field in fields"
              :key="field.id || field.key"
              class="skill-designer-vue-field"
              :class="{ wide: field.wide }"
              :data-field-path="pathKey(fieldPath(field))"
            >
              <span class="skill-designer-vue-label-line">
                <span class="skill-designer-vue-label">{{ field.label }}<b v-if="field.required">*</b></span>
                <span v-if="field.help" class="skill-designer-vue-help" :title="field.help">?</span>
              </span>
              <SkillFieldControl
                :descriptor="field"
                :model-value="fieldValue(field)"
                :disabled="disabled"
                :instance-id="instanceId + '-' + (field.id || field.key)"
                @update:model-value="patch(field, $event)"
              />
            </div>
          </div>
        </div>
      `,
    });

    const SkillEffectPanel = defineComponent({
      name: 'SkillEffectPanel',
      components: { SkillPrototypeList, SkillSideEffectList },
      props: {
        draft: { type: Object, required: true },
        disabled: Boolean,
        modelApi: { type: Object, required: true },
        instanceId: { type: String, required: true },
        objectKey: { type: Function, required: true },
      },
      emits: ['patch', 'structure'],
      template: `
        <div class="skill-designer-vue-panel">
          <section class="skill-designer-vue-section">
            <div class="skill-designer-vue-section-head">
              <div>
                <h3>效果原型</h3>
              </div>
            </div>
            <SkillPrototypeList
              :effects="draft.prototypeEffects || []"
              :path="['prototypeEffects']"
              :disabled="disabled"
              :depth="0"
              :model-api="modelApi"
              :instance-id="instanceId + '-effects'"
              :object-key="objectKey"
              :allow-empty="false"
              @patch="$emit('patch', $event)"
              @structure="$emit('structure', $event)"
            />
          </section>
          <section class="skill-designer-vue-section">
            <div class="skill-designer-vue-section-head">
              <div>
                <h3>副作用</h3>
              </div>
            </div>
            <SkillSideEffectList
              :items="draft.副作用列表 || []"
              :path="['副作用列表']"
              :disabled="disabled"
              :model-api="modelApi"
              :instance-id="instanceId + '-side-effects'"
              :object-key="objectKey"
              @patch="$emit('patch', $event)"
              @structure="$emit('structure', $event)"
            />
          </section>
        </div>
      `,
    });

    const SkillCostPanel = SkillBasicPanel;
    const SkillDescriptionPanel = SkillBasicPanel;

    const SkillDesignerToolbar = defineComponent({
      name: 'SkillDesignerToolbar',
      components: { SkillCombobox },
      props: {
        title: { type: String, default: '魂技设计台' },
        subtitle: { type: String, default: '' },
        switchItems: { type: Array, default: () => [] },
        previewKey: { type: String, default: '' },
        busy: Boolean,
        dirty: Boolean,
        canUndo: Boolean,
        instanceId: { type: String, required: true },
      },
      emits: ['save', 'reload', 'switch-skill', 'undo'],
      setup(props) {
        const switchOptions = computed(() =>
          props.switchItems.map(item => ({ value: item.preview, label: item.label })),
        );
        return { switchOptions };
      },
      template: `
        <header class="skill-designer-vue-toolbar">
          <div class="skill-designer-vue-heading">
            <span>{{ subtitle }}</span>
            <h2>{{ title }}</h2>
          </div>
          <div class="skill-designer-vue-toolbar-actions">
            <SkillCombobox
              v-if="switchItems.length > 1"
              :model-value="previewKey"
              :options="switchOptions"
              :disabled="busy"
              label="技能"
              :instance-id="instanceId + '-switch'"
              @update:model-value="$emit('switch-skill', $event)"
            />
            <button
              type="button"
              class="skill-designer-vue-icon-button"
              :disabled="busy || !canUndo"
              aria-label="撤销上一次结构操作"
              title="撤销"
              @click="$emit('undo')"
            ><i class="fa-solid fa-undo" aria-hidden="true"></i></button>
            <button type="button" class="skill-designer-vue-button" :disabled="busy" @click="$emit('reload')">重新读取</button>
            <button type="button" class="skill-designer-vue-button primary" :disabled="busy" @click="$emit('save')">
              {{ busy ? '处理中…' : dirty ? '保存设计*' : '保存设计' }}
            </button>
          </div>
        </header>
      `,
    });

    const SkillDesignerTabs = defineComponent({
      name: 'SkillDesignerTabs',
      props: {
        tabs: { type: Array, required: true },
        activeTab: { type: String, required: true },
        errorCounts: { type: Object, required: true },
        instanceId: { type: String, required: true },
      },
      emits: ['update:activeTab'],
      setup(props, { emit }) {
        function handleKeydown(event, index) {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const count = props.tabs.length;
          const nextIndex =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? count - 1
                : (index + (event.key === 'ArrowRight' ? 1 : -1) + count) % count;
          const nextTab = props.tabs[nextIndex];
          if (!nextTab) return;
          emit('update:activeTab', nextTab.id);
          nextTick(() => document.getElementById(`${props.instanceId}-tab-${nextTab.id}`)?.focus());
        }
        return { handleKeydown };
      },
      template: `
        <div class="skill-designer-vue-tabs" role="tablist" aria-label="技能设计页签">
          <button
            v-for="(tab, index) in tabs"
            :id="instanceId + '-tab-' + tab.id"
            :key="tab.id"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab.id ? 'true' : 'false'"
            :aria-controls="instanceId + '-panel-' + tab.id"
            :tabindex="activeTab === tab.id ? 0 : -1"
            :class="{ active: activeTab === tab.id, complete: !errorCounts[tab.id], invalid: errorCounts[tab.id] }"
            @click="$emit('update:activeTab', tab.id)"
            @keydown="handleKeydown($event, index)"
          >
            <span>{{ tab.label }}</span>
            <b v-if="errorCounts[tab.id]">{{ errorCounts[tab.id] }}</b>
            <i v-else aria-label="完成">✓</i>
          </button>
        </div>
      `,
    });

    const SkillDesignerPreview = defineComponent({
      name: 'SkillDesignerPreview',
      props: {
        result: { type: Object, default: () => ({}) },
        currentAttributes: { default: () => ({}) },
        expanded: Boolean,
      },
      emits: ['toggle'],
      setup(props) {
        const preview = computed(() => props.result?.preview || {});
        const errors = computed(() => (Array.isArray(props.result?.errors) ? props.result.errors : []));
        const warnings = computed(() => (Array.isArray(props.result?.warnings) ? props.result.warnings : []));
        const attributes = computed(() => {
          if (Array.isArray(props.currentAttributes)) return props.currentAttributes;
          return Object.entries(props.currentAttributes || {}).map(([label, value]) => ({ label, value }));
        });
        return { attributes, errors, preview, warnings };
      },
      template: `
        <aside class="skill-designer-vue-preview" :class="{ expanded }">
          <button type="button" class="skill-designer-vue-preview-toggle" @click="$emit('toggle')">
            <span>实时速览</span>
            <b>{{ errors.length ? errors.length + ' 个问题' : '可保存' }}</b>
          </button>
          <div class="skill-designer-vue-preview-content">
            <div class="skill-designer-vue-preview-hero">
              <small>{{ preview.type || '技能' }}</small>
              <h3>{{ preview.name || '未命名技能' }}</h3>
              <p>{{ preview.summary || '等待有效输入' }}</p>
            </div>
            <dl class="skill-designer-vue-preview-metrics">
              <div><dt>承载</dt><dd>{{ preview.delivery || '未设置' }}</dd></div>
              <div><dt>消耗</dt><dd>{{ preview.cost || '无' }}</dd></div>
              <div><dt>前摇</dt><dd>{{ preview.castTime ?? 0 }}</dd></div>
              <div><dt>COST</dt><dd :class="{ danger: preview.budget && preview.budget.ok === false }">{{ preview.budget?.label || '待评估' }}</dd></div>
            </dl>
            <section v-if="preview.effects?.length" class="skill-designer-vue-preview-section">
              <h4>效果链</h4>
              <ol>
                <li v-for="(effect, index) in preview.effects" :key="index">{{ effect }}</li>
              </ol>
            </section>
            <section v-if="attributes.length" class="skill-designer-vue-preview-section">
              <h4>当前属性</h4>
              <dl class="skill-designer-vue-attribute-list">
                <div v-for="item in attributes" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div>
              </dl>
            </section>
            <section v-if="errors.length" class="skill-designer-vue-message-list error">
              <h4>需要修正</h4>
              <p v-for="(item, index) in errors" :key="index">{{ item.message || item }}</p>
            </section>
            <section v-if="warnings.length" class="skill-designer-vue-message-list warning">
              <h4>自动规整</h4>
              <p v-for="(item, index) in warnings" :key="index">{{ item.message || item }}</p>
            </section>
          </div>
        </aside>
      `,
    });

    const SkillDesignerApp = defineComponent({
      name: 'SkillDesignerApp',
      components: {
        SkillBasicPanel,
        SkillCostPanel,
        SkillDescriptionPanel,
        SkillDesignerPreview,
        SkillDesignerTabs,
        SkillDesignerToolbar,
        SkillEffectPanel,
      },
      props: {
        context: { type: Object, required: true },
        instanceId: { type: String, required: true },
      },
      setup(props) {
        const rawDraft = reactive(cloneValue(props.context.initialRawDraft) || {});
        const revision = shallowRef(0);
        const activeTab = shallowRef('basic');
        const busy = shallowRef(false);
        const dirty = shallowRef(!!props.context.initialDirty);
        const compileResult = shallowRef({
          normalizedDraft: cloneValue(rawDraft),
          nextSkill: null,
          preview: {},
          errors: [],
          warnings: [],
          transformations: [],
        });
        const previewExpanded = shallowRef(false);
        const undoRecord = shallowRef(null);
        const liveMessage = shallowRef('');
        const destroyed = shallowRef(false);
        const operationToken = shallowRef(0);
        const previewToken = shallowRef(0);
        const objectKeys = new WeakMap();
        let objectKeySeed = 0;
        let cacheTimer = 0;
        let compileTimer = 0;
        let skipUnmountCache = false;

        const tabs = Object.freeze([
          { id: 'basic', label: '基础' },
          { id: 'effect', label: '效果' },
          { id: 'cost', label: '消耗' },
          { id: 'description', label: '描述' },
        ]);
        const tabFields = computed(() => ({
          basic: props.context.editorModel.getTabFields('basic', rawDraft),
          cost: props.context.editorModel.getTabFields('cost', rawDraft),
          description: props.context.editorModel.getTabFields('description', rawDraft),
        }));
        const errorCounts = computed(() => {
          const counts = { basic: 0, effect: 0, cost: 0, description: 0 };
          (compileResult.value.errors || []).forEach(error => {
            const tab = error && counts[error.tab] !== undefined ? error.tab : 'effect';
            counts[tab] += 1;
          });
          return counts;
        });

        function objectKey(object, prefix = 'item') {
          if (!object || typeof object !== 'object') return `${prefix}-${String(object)}`;
          if (!objectKeys.has(object)) objectKeys.set(object, `${prefix}-${++objectKeySeed}`);
          return objectKeys.get(object);
        }

        function markChanged() {
          dirty.value = true;
          revision.value += 1;
        }

        function applyPatch(patch) {
          if (busy.value || !patch || !Array.isArray(patch.path)) return;
          if (patch.dependent) {
            const nextDraft = props.context.actions.applyDependentFieldChange(
              cloneValue(rawDraft),
              cloneValue(patch),
            );
            replaceReactiveObject(rawDraft, nextDraft);
          } else {
            setAtPath(rawDraft, patch.path, cloneValue(patch.value));
          }
          markChanged();
        }

        function createUndo(path) {
          undoRecord.value = {
            path: [...path],
            value: cloneValue(getAtPath(rawDraft, path)),
          };
        }

        function ensureArray(path) {
          let value = getAtPath(rawDraft, path);
          if (!Array.isArray(value)) {
            value = [];
            setAtPath(rawDraft, path, value);
          }
          return value;
        }

        function applyStructure(command) {
          if (busy.value || !command || !Array.isArray(command.path)) return;
          const list = ensureArray(command.path);
          createUndo(command.path);
          if (command.type === 'add-prototype') {
            list.push(props.context.actions.createPrototype({ path: command.path, draft: cloneValue(rawDraft) }));
          } else if (command.type === 'add-side-effect') {
            list.push(props.context.editorModel.createSideEffect());
          } else if (command.type === 'add-branch') {
            if (list.length >= 3) return;
            list.push(props.context.editorModel.createConditionBranch());
          } else if (command.type === 'add-condition') {
            list.push(props.context.editorModel.createCondition());
          } else if (command.type === 'remove') {
            if (command.index >= 0 && command.index < list.length) list.splice(command.index, 1);
          } else if (command.type === 'move-up' && command.index > 0) {
            const item = list.splice(command.index, 1)[0];
            list.splice(command.index - 1, 0, item);
          } else if (command.type === 'move-down' && command.index < list.length - 1) {
            const item = list.splice(command.index, 1)[0];
            list.splice(command.index + 1, 0, item);
          }
          markChanged();
        }

        function undo() {
          if (!undoRecord.value || busy.value) return;
          setAtPath(rawDraft, undoRecord.value.path, cloneValue(undoRecord.value.value));
          undoRecord.value = null;
          markChanged();
          liveMessage.value = '已撤销上一次结构操作。';
        }

        function clearTimers() {
          if (cacheTimer) window.clearTimeout(cacheTimer);
          if (compileTimer) window.clearTimeout(compileTimer);
          cacheTimer = 0;
          compileTimer = 0;
        }

        function flushCache() {
          if (cacheTimer) window.clearTimeout(cacheTimer);
          cacheTimer = 0;
          if (dirty.value) props.context.actions.cacheDraft(cloneValue(rawDraft));
        }

        async function compileNow() {
          const token = ++previewToken.value;
          try {
            const result = await Promise.resolve(
              props.context.actions.compileDraft(cloneValue(rawDraft), { dryRun: true }),
            );
            if (destroyed.value || token !== previewToken.value) return;
            compileResult.value = result || compileResult.value;
          } catch (error) {
            if (destroyed.value || token !== previewToken.value) return;
            compileResult.value = {
              ...compileResult.value,
              errors: [{ tab: 'effect', message: error?.message || '预览编译失败。' }],
            };
          }
        }

        function scheduleSideEffects() {
          if (cacheTimer) window.clearTimeout(cacheTimer);
          if (compileTimer) window.clearTimeout(compileTimer);
          if (dirty.value) cacheTimer = window.setTimeout(flushCache, 150);
          compileTimer = window.setTimeout(compileNow, 90);
        }

        function focusFirstError(result) {
          const firstError = Array.isArray(result?.errors) ? result.errors[0] : null;
          if (!firstError) return;
          activeTab.value = firstError.tab || 'effect';
          liveMessage.value = firstError.message || '请修正表单错误。';
          nextTick(() => {
            const selector = firstError.path
              ? `[data-field-path="${String(firstError.path).replace(/"/g, '\\"')}"]`
              : '';
            const root = document.getElementById(props.instanceId);
            const target = selector ? root?.querySelector(selector) : null;
            const activePanel = root?.querySelector(`[data-skill-tab="${activeTab.value}"]`);
            const focusTarget =
              target?.querySelector('input, textarea, button, [tabindex]') ||
              target ||
              activePanel?.querySelector('input, textarea, button, [tabindex]');
            focusTarget?.focus?.();
          });
        }

        async function save() {
          if (busy.value) return;
          if (compileTimer) window.clearTimeout(compileTimer);
          compileTimer = 0;
          flushCache();
          busy.value = true;
          skipUnmountCache = true;
          const token = ++operationToken.value;
          try {
            const result = await Promise.resolve(
              props.context.actions.saveCompiledDraft(cloneValue(rawDraft)),
            );
            if (destroyed.value || token !== operationToken.value) return;
            compileResult.value = result?.compileResult || result || compileResult.value;
            if (compileResult.value.errors?.length) {
              skipUnmountCache = false;
              focusFirstError(compileResult.value);
              return;
            }
            dirty.value = false;
            skipUnmountCache = false;
            undoRecord.value = null;
            liveMessage.value = result?.message || '技能设计已保存。';
          } catch (error) {
            if (destroyed.value || token !== operationToken.value) return;
            skipUnmountCache = false;
            const result = error?.compileResult || {
              ...compileResult.value,
              errors: [{ tab: error?.tab || 'effect', path: error?.path || '', message: error?.message || '保存失败。' }],
            };
            compileResult.value = result;
            focusFirstError(result);
          } finally {
            if (!destroyed.value && token === operationToken.value) busy.value = false;
          }
        }

        async function reload() {
          if (busy.value) return;
          if (dirty.value && !window.confirm('当前设计尚未保存，确定重新读取吗？')) return;
          clearTimers();
          busy.value = true;
          const token = ++operationToken.value;
          try {
            const nextDraft = await Promise.resolve(props.context.actions.reloadDraft());
            if (destroyed.value || token !== operationToken.value || !nextDraft) return;
            replaceReactiveObject(rawDraft, nextDraft);
            dirty.value = false;
            undoRecord.value = null;
            revision.value += 1;
            liveMessage.value = '已重新读取当前技能。';
          } catch (error) {
            if (!destroyed.value && token === operationToken.value) {
              liveMessage.value = error?.message || '重新读取失败。';
            }
          } finally {
            if (!destroyed.value && token === operationToken.value) busy.value = false;
          }
        }

        async function switchSkill(previewKey) {
          if (busy.value || !previewKey || previewKey === props.context.previewKey) return;
          if (compileTimer) window.clearTimeout(compileTimer);
          compileTimer = 0;
          flushCache();
          busy.value = true;
          const token = ++operationToken.value;
          try {
            await Promise.resolve(props.context.actions.switchSkill(previewKey));
          } finally {
            if (!destroyed.value && token === operationToken.value) busy.value = false;
          }
        }

        watch(revision, scheduleSideEffects, { flush: 'post' });
        onMounted(compileNow);
        onBeforeUnmount(() => {
          destroyed.value = true;
          operationToken.value += 1;
          previewToken.value += 1;
          if (dirty.value && !skipUnmountCache) {
            try {
              props.context.actions.cacheDraft(cloneValue(rawDraft));
            } catch (error) {}
          }
          clearTimers();
        });

        return {
          activeTab,
          applyPatch,
          applyStructure,
          busy,
          compileResult,
          dirty,
          errorCounts,
          liveMessage,
          objectKey,
          previewExpanded,
          rawDraft,
          reload,
          save,
          switchSkill,
          tabFields,
          tabs,
          undo,
          undoRecord,
        };
      },
      template: `
        <div :id="instanceId" class="skill-designer-vue-root">
          <SkillDesignerToolbar
            :title="rawDraft.name || context.previewMeta.label || '未命名技能'"
            :subtitle="context.scopeLabels.studioTitle || '魂技设计台'"
            :switch-items="context.switchItems"
            :preview-key="context.previewKey"
            :busy="busy"
            :dirty="dirty"
            :can-undo="!!undoRecord"
            :instance-id="instanceId"
            @save="save"
            @reload="reload"
            @switch-skill="switchSkill"
            @undo="undo"
          />
          <SkillDesignerTabs
            :tabs="tabs"
            :active-tab="activeTab"
            :error-counts="errorCounts"
            :instance-id="instanceId"
            @update:active-tab="activeTab = $event"
          />
          <div class="skill-designer-vue-workspace">
            <main class="skill-designer-vue-editor">
              <SkillBasicPanel
                v-show="activeTab === 'basic'"
                :draft="rawDraft"
                :fields="tabFields.basic"
                :disabled="busy"
                :instance-id="instanceId + '-basic'"
                :id="instanceId + '-panel-basic'"
                :aria-labelledby="instanceId + '-tab-basic'"
                role="tabpanel"
                data-skill-tab="basic"
                @patch="applyPatch"
              />
              <SkillEffectPanel
                v-show="activeTab === 'effect'"
                :draft="rawDraft"
                :disabled="busy"
                :model-api="context.editorModel"
                :instance-id="instanceId + '-effect'"
                :object-key="objectKey"
                :id="instanceId + '-panel-effect'"
                :aria-labelledby="instanceId + '-tab-effect'"
                role="tabpanel"
                data-skill-tab="effect"
                @patch="applyPatch"
                @structure="applyStructure"
              />
              <SkillCostPanel
                v-show="activeTab === 'cost'"
                :draft="rawDraft"
                :fields="tabFields.cost"
                :disabled="busy"
                :instance-id="instanceId + '-cost'"
                :id="instanceId + '-panel-cost'"
                :aria-labelledby="instanceId + '-tab-cost'"
                role="tabpanel"
                data-skill-tab="cost"
                @patch="applyPatch"
              />
              <SkillDescriptionPanel
                v-show="activeTab === 'description'"
                :draft="rawDraft"
                :fields="tabFields.description"
                :disabled="busy"
                :instance-id="instanceId + '-description'"
                :id="instanceId + '-panel-description'"
                :aria-labelledby="instanceId + '-tab-description'"
                role="tabpanel"
                data-skill-tab="description"
                @patch="applyPatch"
              />
            </main>
            <SkillDesignerPreview
              :result="compileResult"
              :current-attributes="context.currentAttributes"
              :expanded="previewExpanded"
              @toggle="previewExpanded = !previewExpanded"
            />
          </div>
          <div class="skill-designer-vue-live-region" aria-live="assertive" aria-atomic="true">{{ liveMessage }}</div>
        </div>
      `,
    });

    return {
      SkillBasicPanel,
      SkillCombobox,
      SkillConditionBuilder,
      SkillCostPanel,
      SkillDescriptionPanel,
      SkillDesignerApp,
      SkillDesignerPreview,
      SkillDesignerTabs,
      SkillDesignerToolbar,
      SkillEffectPanel,
      SkillFieldControl,
      SkillMatcherObject,
      SkillMultiSelect,
      SkillPrototypeEditor,
      SkillPrototypeList,
      SkillSideEffectList,
    };
  }

  function mount(host, context) {
    if (!host || host.nodeType !== 1 || typeof host.replaceChildren !== 'function') {
      throw new Error('技能设计器缺少有效挂载节点。');
    }
    if (!context || !context.actions || !context.editorModel) throw new Error('技能设计器上下文不完整。');
    const Vue = resolveVue();
    if (!Vue) throw new Error('Vue 3.5 运行时未就绪。');
    const existingInstanceId = host.getAttribute('data-skill-designer-vue-mounted');
    const existingController = existingInstanceId ? instances.get(existingInstanceId) : null;
    if (existingController) existingController.destroy();
    const instanceId = `skill-designer-vue-${Date.now()}-${++instanceSeed}`;
    const components = createComponents(Vue);
    const { SkillDesignerApp } = components;
    const app = Vue.createApp({
      name: 'SkillDesignerMountRoot',
      render: () => Vue.h(SkillDesignerApp, { context, instanceId }),
    });
    Object.entries(components).forEach(([name, component]) => app.component(name, component));
    const controller = {
      destroy() {
        if (!instances.has(instanceId)) return;
        instances.delete(instanceId);
        try {
          app.unmount();
        } finally {
          host.replaceChildren();
          host.removeAttribute('data-skill-designer-vue-mounted');
        }
      },
    };
    host.replaceChildren();
    host.setAttribute('data-skill-designer-vue-mounted', instanceId);
    try {
      app.mount(host);
      instances.set(instanceId, controller);
      return controller;
    } catch (error) {
      try {
        app.unmount();
      } catch (unmountError) {}
      host.replaceChildren();
      host.removeAttribute('data-skill-designer-vue-mounted');
      throw error;
    }
  }

  function destroyAll() {
    Array.from(instances.values()).forEach(controller => {
      try {
        controller.destroy();
      } catch (error) {}
    });
    instances.clear();
  }

  globalThis.__LWCS_SKILL_DESIGNER_UI__ = Object.freeze({
    apiVersion: API_VERSION,
    mount,
    destroyAll,
  });
})();
