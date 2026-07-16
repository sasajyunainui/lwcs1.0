(function () {
  'use strict';

  const API_VERSION = 2;
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

  const THEME_TOKEN_NAMES = Object.freeze([
    '--skill-designer-vue-bg',
    '--skill-designer-vue-shell',
    '--skill-designer-vue-editor',
    '--skill-designer-vue-surface',
    '--skill-designer-vue-surface-raised',
    '--skill-designer-vue-surface-floating',
    '--skill-designer-vue-control-bg',
    '--skill-designer-vue-popover-bg',
    '--skill-designer-vue-border',
    '--skill-designer-vue-border-strong',
    '--skill-designer-vue-text',
    '--skill-designer-vue-muted',
    '--skill-designer-vue-accent',
    '--skill-designer-vue-accent-text',
    '--skill-designer-vue-focus',
    '--skill-designer-vue-accent-secondary',
    '--skill-designer-vue-relation',
    '--skill-designer-vue-danger',
    '--skill-designer-vue-success',
    '--skill-designer-vue-warning',
    '--skill-designer-vue-radius',
    '--skill-designer-vue-heading-weight',
    '--skill-designer-vue-body-weight',
    '--skill-designer-vue-theme',
  ]);

  function readThemeTokenStyle(node) {
    if (!node || typeof getComputedStyle !== 'function') return {};
    const source = node.closest?.('.skill-designer-vue-host') || node;
    const computed = getComputedStyle(source);
    return THEME_TOKEN_NAMES.reduce((style, name) => {
      const value = computed.getPropertyValue(name).trim();
      if (value) style[name] = value;
      return style;
    }, {});
  }

  function readThemeName(node) {
    const frame = node?.closest?.('[data-holo-theme]');
    return normalizeText(
      frame?.getAttribute?.('data-holo-theme')
        || document.body?.getAttribute?.('data-mvu-holo-theme')
        || document.body?.getAttribute?.('data-holo-theme'),
      '',
    );
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
        invalid: Boolean,
        inputId: { type: String, default: '' },
        label: { type: String, default: '选项' },
        instanceId: { type: String, required: true },
        describedBy: { type: String, default: '' },
        required: Boolean,
        triggerText: { type: String, default: '' },
      },
      emits: ['update:modelValue'],
      setup(props, { emit }) {
        const open = shallowRef(false);
        const query = shallowRef('');
        const activeIndex = shallowRef(0);
        const trigger = shallowRef(null);
        const searchInput = shallowRef(null);
        const popupStyle = shallowRef({});
        const popupTheme = shallowRef('');
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
        const displayLabel = computed(() => normalizeText(props.triggerText, '') || selectedLabel.value);
        const listboxId = `${props.instanceId}-listbox`;
        const activeDescendant = computed(() => {
          const option = filteredOptions.value[activeIndex.value];
          return option ? `${listboxId}-${option.id}` : '';
        });
        let unmounted = false;
        let openListenersBound = false;
        let themeObserver = null;

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
            ...readThemeTokenStyle(trigger.value),
            position: 'fixed',
            left: `${left}px`,
            top: `${top}px`,
            width: `${width}px`,
            maxHeight: `${maxHeight}px`,
            zIndex: 100000,
          };
          popupTheme.value = readThemeName(trigger.value);
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
          if (typeof MutationObserver === 'function' && document.body) {
            themeObserver = new MutationObserver(records => {
              const popup = document.getElementById(`${props.instanceId}-popup`);
              if (records.some(record => record.target !== popup && !popup?.contains(record.target))) close();
            });
            themeObserver.observe(document.body, {
              attributes: true,
              attributeFilter: ['data-mvu-holo-theme', 'data-holo-theme'],
              subtree: true,
            });
          }
          openListenersBound = true;
        }

        function unbindOpenListeners() {
          if (!openListenersBound) return;
          window.removeEventListener('resize', updatePosition);
          window.removeEventListener('scroll', updatePosition, true);
          document.removeEventListener('pointerdown', handleOutsidePointer, true);
          themeObserver?.disconnect();
          themeObserver = null;
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
            event.stopPropagation();
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
          displayLabel,
          filteredOptions,
          handleKeydown,
          listboxId,
          open,
          popupStyle,
          popupTheme,
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
            :id="inputId || undefined"
            type="button"
            class="skill-designer-vue-control skill-designer-vue-combobox-trigger"
            :disabled="disabled"
            :aria-label="label + '：' + selectedLabel"
            :aria-expanded="open ? 'true' : 'false'"
            :aria-controls="listboxId"
            :aria-invalid="invalid ? 'true' : 'false'"
            :aria-describedby="describedBy || undefined"
            :aria-required="required ? 'true' : 'false'"
            aria-haspopup="listbox"
            @click="open ? close() : show()"
            @keydown="handleKeydown"
          >
            <span>{{ displayLabel }}</span>
            <i class="fa-solid fa-chevron-down skill-designer-vue-chevron" aria-hidden="true"></i>
          </button>
          <Teleport to="body">
            <div
              v-if="open"
              :id="instanceId + '-popup'"
              class="skill-designer-vue-popover"
              :style="popupStyle"
              :data-holo-theme="popupTheme || undefined"
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
        invalid: Boolean,
        inputId: { type: String, default: '' },
        label: { type: String, default: '选项' },
        instanceId: { type: String, required: true },
        describedBy: { type: String, default: '' },
        required: Boolean,
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
        <div class="skill-designer-vue-multiselect" :class="{ invalid }">
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
            :invalid="invalid"
            :input-id="inputId"
            :described-by="describedBy"
            :required="required"
            :label="label"
            :instance-id="instanceId + '-add'"
            @update:model-value="add"
          />
          <div v-else-if="!modelValue.length" class="skill-designer-vue-empty-inline">暂无可选项</div>
        </div>
      `,
    });

    const SkillSegmentedControl = defineComponent({
      name: 'SkillSegmentedControl',
      props: {
        modelValue: { default: '' },
        options: { type: Array, default: () => [] },
        disabled: Boolean,
        invalid: Boolean,
        inputId: { type: String, default: '' },
        label: { type: String, default: '选项' },
        compact: Boolean,
        describedBy: { type: String, default: '' },
        required: Boolean,
      },
      emits: ['update:modelValue'],
      setup(props, { emit }) {
        function optionValue(option) {
          return option && typeof option === 'object' ? option.value : option;
        }
        const selectedIndex = computed(() => {
          const index = props.options.findIndex(option => String(optionValue(option)) === String(props.modelValue));
          return index >= 0 ? index : 0;
        });
        function optionLabel(option) {
          const value = optionValue(option);
          return option && typeof option === 'object' ? option.label ?? value : value;
        }
        function handleKeydown(event, index) {
          if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const count = props.options.length;
          if (!count) return;
          const nextIndex =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? count - 1
                : (index + (event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1) + count) % count;
          const option = props.options[nextIndex];
          const group = event.currentTarget?.parentElement;
          emit('update:modelValue', optionValue(option));
          nextTick(() => group?.querySelectorAll('[role="radio"]')[nextIndex]?.focus());
        }
        return { handleKeydown, optionLabel, optionValue, selectedIndex };
      },
      template: `
        <div
          class="skill-designer-vue-segmented"
          :class="{ compact }"
          role="radiogroup"
          :aria-label="label"
          :aria-invalid="invalid ? 'true' : 'false'"
          :aria-describedby="describedBy || undefined"
          :aria-required="required ? 'true' : 'false'"
        >
          <button
            v-for="(option, index) in options"
            :key="String(optionValue(option))"
            :id="index === 0 && inputId ? inputId : undefined"
            type="button"
            role="radio"
            :aria-checked="String(modelValue) === String(optionValue(option)) ? 'true' : 'false'"
            :tabindex="index === selectedIndex ? 0 : -1"
            :class="{ active: String(modelValue) === String(optionValue(option)) }"
            :disabled="disabled"
            @click="$emit('update:modelValue', optionValue(option))"
            @keydown="handleKeydown($event, index)"
          >{{ optionLabel(option) }}</button>
        </div>
      `,
    });

    const SkillDurationInput = defineComponent({
      name: 'SkillDurationInput',
      props: {
        modelValue: { default: '' },
        disabled: Boolean,
        invalid: Boolean,
        inputId: { type: String, default: '' },
        label: { type: String, default: '有效时长' },
        minTicks: { type: [Number, String], default: 0 },
        maxTicks: { type: [Number, String], default: 0 },
        describedBy: { type: String, default: '' },
        required: Boolean,
      },
      emits: ['update:modelValue'],
      setup(props, { emit }) {
        const days = shallowRef('');
        const hours = shallowRef('');
        const minutes = shallowRef('');
        const syncFromTicks = value => {
          if (value === '' || value === null || value === undefined) {
            days.value = '';
            hours.value = '';
            minutes.value = '';
            return;
          }
          const ticks = Number(value);
          if (!Number.isFinite(ticks) || ticks < 0) return;
          const totalMinutes = Math.floor(ticks) * 10;
          days.value = String(Math.floor(totalMinutes / 1440));
          hours.value = String(Math.floor((totalMinutes % 1440) / 60));
          minutes.value = String(totalMinutes % 60);
        };
        const emitTicks = () => {
          const parts = [days.value, hours.value, minutes.value];
          if (parts.every(part => part === '')) {
            emit('update:modelValue', '');
            return;
          }
          if (parts.some(part => part !== '' && !/^\\d+$/.test(part))) return;
          const totalMinutes =
            Number(days.value || 0) * 1440 +
            Number(hours.value || 0) * 60 +
            Number(minutes.value || 0);
          if (totalMinutes % 10 !== 0) return;
          const ticks = totalMinutes / 10;
          if (ticks < Math.max(0, Number(props.minTicks) || 0)) return;
          if (Number(props.maxTicks) > 0 && ticks > Number(props.maxTicks)) return;
          emit('update:modelValue', String(ticks));
        };
        function normalizeParts() {
          const parts = [days.value, hours.value, minutes.value];
          if (parts.every(part => part === '')) return;
          const dayValue = Math.max(0, Number.parseInt(days.value || '0', 10) || 0);
          const hourValue = Math.min(23, Math.max(0, Number.parseInt(hours.value || '0', 10) || 0));
          const minuteValue = Math.min(59, Math.max(0, Number.parseInt(minutes.value || '0', 10) || 0));
          const roundedMinutes = Math.max(
            0,
            Math.round((dayValue * 1440 + hourValue * 60 + minuteValue) / 10) * 10,
          );
          const minTicks = Math.max(0, Number(props.minTicks) || 0);
          const maxTicks = Number(props.maxTicks) > 0 ? Math.max(minTicks, Number(props.maxTicks)) : Infinity;
          const normalizedTicks = Math.min(maxTicks, Math.max(minTicks, roundedMinutes / 10));
          const totalMinutes = normalizedTicks * 10;
          days.value = String(Math.floor(totalMinutes / 1440));
          hours.value = String(Math.floor((totalMinutes % 1440) / 60));
          minutes.value = String(totalMinutes % 60);
          emitTicks();
        }
        watch(() => props.modelValue, syncFromTicks, { immediate: true });
        function updatePart(part, event) {
          const value = String(event.target.value || '').replace(/[^0-9]/g, '');
          if (part === 'days') days.value = value;
          else if (part === 'hours') hours.value = value;
          else minutes.value = value;
          emitTicks();
        }
        return { days, hours, minutes, normalizeParts, updatePart };
      },
      template: `
        <div class="skill-designer-vue-duration" :aria-label="label">
          <label><input :id="inputId || undefined" :value="days" type="text" inputmode="numeric" :disabled="disabled" :aria-label="label + '，日'" :aria-invalid="invalid ? 'true' : 'false'" :aria-describedby="describedBy || undefined" :aria-required="required ? 'true' : 'false'" @input="updatePart('days', $event)" @blur="normalizeParts"><span>日</span></label>
          <label><input :id="inputId ? inputId + '-hours' : undefined" :value="hours" type="text" inputmode="numeric" :disabled="disabled" :aria-label="label + '，时'" :aria-invalid="invalid ? 'true' : 'false'" :aria-describedby="describedBy || undefined" :aria-required="required ? 'true' : 'false'" @input="updatePart('hours', $event)" @blur="normalizeParts"><span>时</span></label>
          <label><input :id="inputId ? inputId + '-minutes' : undefined" :value="minutes" type="text" inputmode="numeric" :disabled="disabled" :aria-label="label + '，分'" :aria-invalid="invalid ? 'true' : 'false'" :aria-describedby="describedBy || undefined" :aria-required="required ? 'true' : 'false'" @input="updatePart('minutes', $event)" @blur="normalizeParts"><span>分</span></label>
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
        inputId: { type: String, default: '' },
        invalid: Boolean,
        describedBy: { type: String, default: '' },
        required: Boolean,
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
              :invalid="invalid"
              :input-id="(inputId || instanceId) + '-' + field.key"
              :label="field.label"
              :instance-id="instanceId + '-' + field.key"
              :described-by="describedBy"
              :required="required || field.required"
              @update:model-value="patch(field.key, $event)"
            />
            <SkillCombobox
              v-else-if="field.control === 'singleEnum'"
              :model-value="modelValue[field.key] || ''"
              :options="field.options"
              :disabled="disabled"
              :invalid="invalid"
              :input-id="(inputId || instanceId) + '-' + field.key"
              :label="field.label"
              :instance-id="instanceId + '-' + field.key"
              :described-by="describedBy"
              :required="required || field.required"
              @update:model-value="patch(field.key, $event)"
            />
            <input
              v-else
              :id="(inputId || instanceId) + '-' + field.key"
              class="skill-designer-vue-control"
              type="text"
              :name="field.key"
              autocomplete="off"
              :value="modelValue[field.key] || ''"
              :disabled="disabled"
              :aria-label="field.label"
              :aria-invalid="invalid ? 'true' : 'false'"
              :aria-describedby="describedBy || undefined"
              :aria-required="required || field.required ? 'true' : 'false'"
              @input="patch(field.key, $event.target.value)"
            />
          </div>
        </div>
      `,
    });

    const SkillHelpButton = defineComponent({
      name: 'SkillHelpButton',
      props: {
        text: { type: String, default: '' },
        label: { type: String, default: '' },
        instanceId: { type: String, default: '' },
      },
      setup(props) {
        const open = shallowRef(false);
        const button = shallowRef(null);
        const popoverId = `${props.instanceId || 'skill-help'}-help`;
        let outsideListenerBound = false;

        function handleOutsidePointer(event) {
          if (button.value?.parentElement?.contains(event.target)) return;
          close(false);
        }

        function close(returnFocus = true) {
          if (!open.value) return;
          open.value = false;
          if (outsideListenerBound) {
            document.removeEventListener('pointerdown', handleOutsidePointer, true);
            outsideListenerBound = false;
          }
          if (returnFocus) nextTick(() => button.value?.focus?.());
        }

        function toggle() {
          if (!props.text) return;
          if (open.value) {
            close(false);
            return;
          }
          open.value = true;
          if (!outsideListenerBound) {
            document.addEventListener('pointerdown', handleOutsidePointer, true);
            outsideListenerBound = true;
          }
        }

        function handleKeydown(event) {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          close();
        }

        onBeforeUnmount(() => close(false));

        return { button, handleKeydown, open, popoverId, toggle };
      },
      template: `
        <span v-if="text" class="skill-designer-vue-help-wrap">
          <button
            ref="button"
            type="button"
            class="skill-designer-vue-help"
            :aria-label="'查看' + (label || '字段') + '帮助'"
            :aria-expanded="open ? 'true' : 'false'"
            :aria-controls="popoverId"
            title="查看帮助"
            @click="toggle"
            @keydown="handleKeydown"
          ><i class="fa-solid fa-circle-info" aria-hidden="true"></i></button>
          <span v-if="open" :id="popoverId" class="skill-designer-vue-help-popover" role="tooltip">{{ text }}</span>
        </span>
      `,
    });

    const SkillFieldShell = defineComponent({
      name: 'SkillFieldShell',
      components: { SkillHelpButton },
      props: {
        descriptor: { type: Object, required: true },
        inputId: { type: String, default: '' },
        fieldPath: { type: String, default: '' },
        error: { type: Object, default: null },
      },
      template: `
        <div
          class="skill-designer-vue-field"
          :class="{ wide: descriptor.wide }"
          :data-field-path="fieldPath || undefined"
        >
          <div class="skill-designer-vue-label-line">
            <label class="skill-designer-vue-label" :for="inputId || undefined">
              {{ descriptor.label }}<b v-if="descriptor.required">*</b>
            </label>
            <span class="skill-designer-vue-field-meta">
              <small v-if="descriptor.unit" class="skill-designer-vue-field-unit">{{ descriptor.unit }}</small>
              <SkillHelpButton :text="descriptor.help" :label="descriptor.label" :instance-id="inputId + '-help'" />
            </span>
          </div>
          <slot></slot>
          <small
            v-if="error"
            :id="inputId + '-error'"
            class="skill-designer-vue-field-error"
          >{{ error.message }}</small>
        </div>
      `,
    });

    const SkillFieldControl = defineComponent({
      name: 'SkillFieldControl',
      components: { SkillCombobox, SkillDurationInput, SkillMatcherObject, SkillMultiSelect, SkillSegmentedControl },
      props: {
        descriptor: { type: Object, required: true },
        modelValue: { default: '' },
        disabled: Boolean,
        instanceId: { type: String, required: true },
        inputId: { type: String, default: '' },
        invalid: Boolean,
        describedBy: { type: String, default: '' },
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
              :id="inputId || undefined"
              type="checkbox"
              :name="descriptor.key || descriptor.label"
              :checked="modelValue === true || modelValue === '启用'"
              :disabled="disabled"
              :aria-label="descriptor.label"
              :aria-required="descriptor.required ? 'true' : 'false'"
              :aria-invalid="invalid ? 'true' : 'false'"
              :aria-describedby="describedBy || undefined"
              @change="update($event.target.checked ? (descriptor.trueValue ?? '启用') : (descriptor.falseValue ?? '无'))"
            />
            <span aria-hidden="true"></span>
            <em>{{ modelValue === true || modelValue === '启用' ? '启用' : '关闭' }}</em>
          </label>
          <SkillSegmentedControl
            v-else-if="descriptor.control === 'segmented'"
            :model-value="modelValue"
            :options="descriptor.options"
            :disabled="disabled"
            :label="descriptor.label"
            :compact="descriptor.compact"
            :invalid="invalid"
            :input-id="inputId"
            :described-by="describedBy"
            :required="descriptor.required"
            @update:model-value="update"
          />
          <SkillCombobox
            v-else-if="descriptor.control === 'singleEnum'"
            :model-value="modelValue"
            :options="descriptor.options"
            :disabled="disabled"
            :label="descriptor.label"
            :instance-id="instanceId"
            :invalid="invalid"
            :input-id="inputId"
            :described-by="describedBy"
            :required="descriptor.required"
            @update:model-value="update"
          />
          <SkillMultiSelect
            v-else-if="descriptor.control === 'multiEnum'"
            :model-value="Array.isArray(modelValue) ? modelValue : modelValue ? String(modelValue).split(/[、,，|/]/).filter(Boolean) : []"
            :options="descriptor.options"
            :disabled="disabled"
            :label="descriptor.label"
            :instance-id="instanceId"
            :invalid="invalid"
            :input-id="inputId"
            :described-by="describedBy"
            :required="descriptor.required"
            @update:model-value="update"
          />
          <SkillMatcherObject
            v-else-if="descriptor.control === 'matcherObject'"
            :model-value="modelValue && typeof modelValue === 'object' ? modelValue : {}"
            :descriptor="descriptor"
            :disabled="disabled"
            :instance-id="instanceId"
            :input-id="inputId"
            :invalid="invalid"
            :described-by="describedBy"
            :required="descriptor.required"
            @update:model-value="update"
          />
          <SkillDurationInput
            v-else-if="descriptor.control === 'duration'"
            :model-value="modelValue"
            :disabled="disabled"
            :label="descriptor.label"
            :invalid="invalid"
            :input-id="inputId"
            :min-ticks="descriptor.min"
            :max-ticks="descriptor.max"
            :described-by="describedBy"
            :required="descriptor.required"
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
            :id="inputId || undefined"
            :aria-label="descriptor.label"
            :aria-required="descriptor.required ? 'true' : 'false'"
            :aria-invalid="invalid ? 'true' : 'false'"
            :aria-describedby="describedBy || undefined"
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
            :id="inputId || undefined"
            :aria-label="descriptor.label"
            :aria-required="descriptor.required ? 'true' : 'false'"
            :aria-invalid="invalid ? 'true' : 'false'"
            :aria-describedby="describedBy || undefined"
            @input="updateInput"
          />
        </div>
      `,
    });

    const SkillConditionBuilder = defineComponent({
      name: 'SkillConditionBuilder',
      components: { SkillCombobox, SkillFieldControl, SkillSegmentedControl },
      props: {
        branches: { type: Array, default: () => [] },
        path: { type: Array, required: true },
        disabled: Boolean,
        depth: { type: Number, default: 0 },
        modelApi: { type: Object, required: true },
        instanceId: { type: String, required: true },
        objectKey: { type: Function, required: true },
        collapseMode: { type: String, default: 'normal' },
        revealPath: { type: String, default: '' },
        errorPaths: { type: Array, default: () => [] },
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
                <SkillSegmentedControl
                  v-if="conditionModel(condition).showCompare"
                  :model-value="condition.比较"
                  :options="conditionModel(condition).compareOptions"
                  :disabled="disabled"
                  label="比较方式"
                  compact
                  @update:model-value="emit('patch', { path: conditionPath(branchIndex, conditionIndex, '比较'), value: $event, dependent: true })"
                />
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
            ><i class="fa-solid fa-plus" aria-hidden="true"></i>判定</button>
            <div class="skill-designer-vue-condition-action">
              <span class="skill-designer-vue-label">满足后</span>
              <SkillSegmentedControl
                :model-value="branch.处理"
                :options="modelApi.conditionActionOptions"
                :disabled="disabled"
                label="满足后的处理方式"
                compact
                @update:model-value="emit('patch', { path: branchPath(branchIndex, '处理'), value: $event, dependent: true })"
              />
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
              :collapse-mode="collapseMode"
              :reveal-path="revealPath"
              :error-paths="errorPaths"
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
          ><i class="fa-solid fa-plus" aria-hidden="true"></i>条件分支</button>
          <span v-if="branches.length >= 3" class="skill-designer-vue-limit-note">已达到 3 个分支上限</span>
        </div>
      `,
    });

    const SkillPrototypeEditor = defineComponent({
      name: 'SkillPrototypeEditor',
      components: { SkillCombobox, SkillConditionBuilder, SkillFieldControl, SkillFieldShell },
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
        canDuplicate: { type: Boolean, default: true },
        collapseMode: { type: String, default: 'normal' },
        revealPath: { type: String, default: '' },
        errorPaths: { type: Array, default: () => [] },
      },
      emits: ['patch', 'structure'],
      setup(props, { emit }) {
        const model = computed(() => props.modelApi.getPrototypeModel(props.effect, { depth: props.depth }));
        const expanded = shallowRef(props.depth === 0 && props.index === 0);
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
        const effectPath = computed(() => pathKey([...props.path, props.index]));
        const hasError = computed(() =>
          props.errorPaths.some(error => {
            const errorPath = String(error && error.path || '');
            return errorPath === effectPath.value
              || errorPath.startsWith(`${effectPath.value}.`)
              || effectPath.value.startsWith(`${errorPath}.`);
          }),
        );
        function matchesReveal(path = props.revealPath) {
          const targetPath = String(path || '');
          return !!targetPath && (
            targetPath === effectPath.value
            || targetPath.startsWith(`${effectPath.value}.`)
            || effectPath.value.startsWith(`${targetPath}.`)
          );
        }
        function fieldError(field) {
          const currentPath = pathKey(fieldPath(field.key));
          return props.errorPaths.find(error => {
            const errorPath = String(error && error.path || '');
            return errorPath === currentPath
              || errorPath.startsWith(`${currentPath}.`)
              || currentPath.startsWith(`${errorPath}.`);
          }) || null;
        }
        const collapsed = computed(() =>
          matchesReveal()
            ? false
            : props.collapseMode === 'all'
              ? true
              : props.collapseMode === 'errors'
                ? !hasError.value
                : !expanded.value && !hasError.value,
        );
        const primaryFields = computed(() =>
          model.value.fields.filter(field => field.presentation !== 'advanced'),
        );
        const advancedGroups = computed(() => {
          const groupLabels = {
            identity: '身份与承载',
            target: '目标与匹配',
            value: '数值与资源',
            timing: '时序与次数',
            scaling: '成长与缩放',
            condition: '条件与规则',
          };
          const order = ['identity', 'target', 'value', 'timing', 'scaling', 'condition'];
          const grouped = new Map();
          model.value.fields
            .filter(field => field.presentation === 'advanced')
            .forEach(field => {
              const key = groupLabels[field.group] ? field.group : 'identity';
              if (!grouped.has(key)) grouped.set(key, []);
              grouped.get(key).push(field);
            });
          return order
            .filter(key => grouped.has(key))
            .map(key => ({ key, label: groupLabels[key], fields: grouped.get(key) }));
        });
        const relationLabel = computed(() => {
          if (props.depth === 0) return '主效果';
          const relation = String(props.path[props.path.length - 1] || '');
          return {
            附加效果: '附加',
            授予效果: '授予',
            使用效果: '使用',
            结算效果: '结算',
            抹消对象: '抹消',
            替换效果: '替换',
            追加效果: '追加',
          }[relation] || (props.effect.生效方式 === '跟随主原型' ? '附加' : '嵌套');
        });
        function toggleExpanded() {
          if (props.collapseMode !== 'normal') return;
          expanded.value = !expanded.value;
        }
        function activateEditor() {
          if (props.collapseMode === 'normal') expanded.value = true;
        }
        watch(
          () => props.revealPath,
          value => {
            if (matchesReveal(value)) expanded.value = true;
          },
        );
        return {
          activateEditor,
          advancedGroups,
          collapsed,
          emit,
          effectPath,
          fieldError,
          fieldPath,
          hasError,
          model,
          patchField,
          primaryFields,
          relationLabel,
          toggleExpanded,
        };
      },
      template: `
        <section
          class="skill-designer-vue-prototype"
          :class="{ nested: depth > 0, collapsed, 'has-error': hasError }"
          :data-prototype-path="effectPath"
          @focusin="activateEditor"
        >
          <div class="skill-designer-vue-prototype-head">
            <div class="skill-designer-vue-prototype-identity">
              <span class="skill-designer-vue-prototype-index">原型 {{ index + 1 }}</span>
              <span class="skill-designer-vue-nested-tag">{{ relationLabel }}</span>
            </div>
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
                :disabled="disabled || collapseMode !== 'normal'"
                :aria-label="collapsed ? '展开原型' : '折叠原型'"
                :title="collapsed ? '展开原型' : '折叠原型'"
                @click="toggleExpanded"
              ><i :class="collapsed ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up'" aria-hidden="true"></i></button>
              <button
                type="button"
                class="skill-designer-vue-icon-button"
                v-if="index > 0"
                :disabled="disabled"
                aria-label="上移原型"
                title="上移"
                @click="emit('structure', { type: 'move-up', path, index })"
              ><i class="fa-solid fa-arrow-up" aria-hidden="true"></i></button>
              <button
                type="button"
                class="skill-designer-vue-icon-button"
                v-if="index < count - 1"
                :disabled="disabled"
                aria-label="下移原型"
                title="下移"
                @click="emit('structure', { type: 'move-down', path, index })"
              ><i class="fa-solid fa-arrow-down" aria-hidden="true"></i></button>
              <button
                type="button"
                class="skill-designer-vue-icon-button"
                :disabled="disabled || !canDuplicate"
                aria-label="复制原型"
                :title="canDuplicate ? '复制原型' : '已达到当前原型数量上限'"
                @click="emit('structure', { type: 'duplicate', path, index })"
              ><i class="fa-solid fa-copy" aria-hidden="true"></i></button>
              <button
                type="button"
                class="skill-designer-vue-icon-button danger"
                v-if="allowEmpty || count > 1"
                :disabled="disabled"
                aria-label="删除原型"
                title="删除"
                @click="emit('structure', { type: 'remove', path, index })"
              ><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
            </div>
          </div>
          <p v-if="model.summary" class="skill-designer-vue-prototype-summary">{{ model.summary }}</p>
          <div v-if="!collapsed" class="skill-designer-vue-field-grid">
            <template v-for="field in primaryFields" :key="field.key">
              <div
                v-if="field.control === 'conditionList'"
                class="skill-designer-vue-field wide"
                :data-field-path="pathKey(fieldPath(field.key))"
              >
                <div class="skill-designer-vue-label-line">
                  <span class="skill-designer-vue-label">{{ field.label }}</span>
                  <SkillHelpButton :text="field.help" :instance-id="instanceId + '-help-' + field.key" />
                </div>
                <SkillConditionBuilder
                  :branches="Array.isArray(effect[field.key]) ? effect[field.key] : []"
                  :path="fieldPath(field.key)"
                  :disabled="disabled"
                  :depth="depth"
                  :model-api="modelApi"
                  :instance-id="instanceId + '-conditions'"
                   :object-key="objectKey"
                   :collapse-mode="collapseMode"
                   :reveal-path="revealPath"
                   :error-paths="errorPaths"
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
                  <SkillHelpButton :text="field.help" :instance-id="instanceId + '-help-' + field.key" />
                </div>
                <SkillPrototypeList
                  :effects="Array.isArray(effect[field.key]) ? effect[field.key] : []"
                  :path="fieldPath(field.key)"
                  :disabled="disabled"
                  :depth="depth + 1"
                  :model-api="modelApi"
                  :instance-id="instanceId + '-nested-' + field.key"
                   :object-key="objectKey"
                   :collapse-mode="collapseMode"
                   :reveal-path="revealPath"
                   :error-paths="errorPaths"
                  :allow-empty="false"
                  @patch="emit('patch', $event)"
                  @structure="emit('structure', $event)"
                />
              </div>
              <SkillFieldShell
                v-else
                :descriptor="field"
                :input-id="instanceId + '-field-' + field.key"
                :field-path="pathKey(fieldPath(field.key))"
                :error="fieldError(field)"
              >
                <SkillFieldControl
                  :descriptor="field"
                  :model-value="effect[field.key] ?? field.defaultValue ?? ''"
                  :disabled="disabled"
                  :instance-id="instanceId + '-field-' + field.key"
                  :input-id="instanceId + '-field-' + field.key"
                  :invalid="!!fieldError(field)"
                  :described-by="fieldError(field) ? instanceId + '-field-' + field.key + '-error' : ''"
                  @update:model-value="patchField(field, $event)"
                />
              </SkillFieldShell>
            </template>
            <details
              v-for="group in advancedGroups"
              :key="group.key"
              class="skill-designer-vue-advanced-fields wide"
            >
              <summary>
                <span>{{ group.label }}</span>
                <b>{{ group.fields.length }} 项</b>
                <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
              </summary>
              <div class="skill-designer-vue-field-grid">
                <template v-for="field in group.fields" :key="field.key">
                  <div
                    v-if="field.control === 'conditionList'"
                    class="skill-designer-vue-field wide"
                    :data-field-path="pathKey(fieldPath(field.key))"
                  >
                    <div class="skill-designer-vue-label-line">
                      <span class="skill-designer-vue-label">{{ field.label }}</span>
                      <SkillHelpButton :text="field.help" :instance-id="instanceId + '-help-' + field.key" />
                    </div>
                    <SkillConditionBuilder
                      :branches="Array.isArray(effect[field.key]) ? effect[field.key] : []"
                      :path="fieldPath(field.key)"
                      :disabled="disabled"
                      :depth="depth"
                      :model-api="modelApi"
                      :instance-id="instanceId + '-conditions'"
                      :object-key="objectKey"
                      :collapse-mode="collapseMode"
                      :reveal-path="revealPath"
                      :error-paths="errorPaths"
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
                      <SkillHelpButton :text="field.help" :instance-id="instanceId + '-help-' + field.key" />
                    </div>
                    <SkillPrototypeList
                      :effects="Array.isArray(effect[field.key]) ? effect[field.key] : []"
                      :path="fieldPath(field.key)"
                      :disabled="disabled"
                      :depth="depth + 1"
                      :model-api="modelApi"
                      :instance-id="instanceId + '-nested-' + field.key"
                      :object-key="objectKey"
                      :collapse-mode="collapseMode"
                      :reveal-path="revealPath"
                      :error-paths="errorPaths"
                      :allow-empty="false"
                      @patch="emit('patch', $event)"
                      @structure="emit('structure', $event)"
                    />
                  </div>
                  <SkillFieldShell
                    v-else
                    :descriptor="field"
                    :input-id="instanceId + '-field-' + field.key"
                    :field-path="pathKey(fieldPath(field.key))"
                    :error="fieldError(field)"
                  >
                    <SkillFieldControl
                      :descriptor="field"
                      :model-value="effect[field.key] ?? field.defaultValue ?? ''"
                      :disabled="disabled"
                      :instance-id="instanceId + '-field-' + field.key"
                      :input-id="instanceId + '-field-' + field.key"
                      :invalid="!!fieldError(field)"
                      :described-by="fieldError(field) ? instanceId + '-field-' + field.key + '-error' : ''"
                      @update:model-value="patchField(field, $event)"
                    />
                  </SkillFieldShell>
                </template>
              </div>
            </details>
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
        collapseMode: { type: String, default: 'normal' },
        revealPath: { type: String, default: '' },
        errorPaths: { type: Array, default: () => [] },
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
          <div v-if="!effects.length" class="skill-designer-vue-empty-state">
            <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
            <strong>{{ depth > 0 ? '尚未添加分支效果' : '尚未建立效果原型' }}</strong>
            <span>{{ depth > 0 ? '添加一个追加或替换效果。' : '先添加一个主效果，再按需要配置条件与副作用。' }}</span>
          </div>
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
            :can-duplicate="effects.length < maxCount"
            :collapse-mode="collapseMode"
            :reveal-path="revealPath"
            :error-paths="errorPaths"
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
            ><i class="fa-solid fa-plus" aria-hidden="true"></i>新增原型</button>
            <span v-if="limitReason" class="skill-designer-vue-limit-note">{{ limitReason }}</span>
          </div>
        </div>
      `,
    });

    const SkillSideEffectList = defineComponent({
      name: 'SkillSideEffectList',
      components: { SkillFieldControl, SkillFieldShell },
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
        function primaryFields(item) {
          return props.modelApi
            .getSideEffectModel(item)
            .fields
            .filter(field => field.presentation !== 'advanced');
        }
        function advancedFields(item) {
          return props.modelApi
            .getSideEffectModel(item)
            .fields
            .filter(field => field.presentation === 'advanced');
        }
        return { advancedFields, emit, pathKey, primaryFields };
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
              <SkillFieldShell
                v-for="field in primaryFields(item)"
                :key="field.key"
                :descriptor="field"
                :input-id="instanceId + '-' + index + '-' + field.key"
                :field-path="pathKey([...path, index, field.key])"
              >
                <SkillFieldControl
                  :descriptor="field"
                  :model-value="item[field.key] ?? field.defaultValue ?? ''"
                  :disabled="disabled"
                  :instance-id="instanceId + '-' + index + '-' + field.key"
                  :input-id="instanceId + '-' + index + '-' + field.key"
                  @update:model-value="emit('patch', { path: [...path, index, field.key], value: $event, dependent: !!field.dependent })"
                />
              </SkillFieldShell>
              <details
                v-if="advancedFields(item).length"
                class="skill-designer-vue-advanced-fields wide"
              >
                <summary>
                  <span>高级设置</span>
                  <b>{{ advancedFields(item).length }} 项</b>
                  <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
                </summary>
                <div class="skill-designer-vue-field-grid">
                  <SkillFieldShell
                    v-for="field in advancedFields(item)"
                    :key="field.key"
                    :descriptor="field"
                    :input-id="instanceId + '-' + index + '-' + field.key"
                    :field-path="pathKey([...path, index, field.key])"
                  >
                    <SkillFieldControl
                      :descriptor="field"
                      :model-value="item[field.key] ?? field.defaultValue ?? ''"
                      :disabled="disabled"
                      :instance-id="instanceId + '-' + index + '-' + field.key"
                      :input-id="instanceId + '-' + index + '-' + field.key"
                      @update:model-value="emit('patch', { path: [...path, index, field.key], value: $event, dependent: !!field.dependent })"
                    />
                  </SkillFieldShell>
                </div>
              </details>
            </div>
            <p class="skill-designer-vue-row-summary">{{ modelApi.getSideEffectModel(item).summary }}</p>
          </div>
          <button
            type="button"
            class="skill-designer-vue-text-button"
            :disabled="disabled"
            @click="emit('structure', { type: 'add-side-effect', path })"
          ><i class="fa-solid fa-plus" aria-hidden="true"></i>副作用</button>
        </div>
      `,
    });

    const createSkillFieldPanel = name => defineComponent({
      name,
      components: { SkillFieldControl, SkillFieldShell },
      props: {
        draft: { type: Object, required: true },
        fields: { type: Array, default: () => [] },
        disabled: Boolean,
        instanceId: { type: String, required: true },
        errorPaths: { type: Array, default: () => [] },
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
        function fieldError(field) {
          const currentPath = pathKey(fieldPath(field));
          return props.errorPaths.find(error => {
            const errorPath = String(error && error.path || '');
            return errorPath === currentPath
              || errorPath.startsWith(`${currentPath}.`)
              || currentPath.startsWith(`${errorPath}.`);
          }) || null;
        }
        const primaryFields = computed(() =>
          props.fields.filter(field => field.presentation !== 'advanced'),
        );
        const advancedGroups = computed(() => {
          const groupLabels = {
            identity: '身份与承载',
            target: '目标与匹配',
            value: '数值与资源',
            timing: '时序与次数',
            scaling: '成长与缩放',
            condition: '条件与规则',
          };
          const order = ['identity', 'target', 'value', 'timing', 'scaling', 'condition'];
          const grouped = new Map();
          props.fields
            .filter(field => field.presentation === 'advanced')
            .forEach(field => {
              const key = groupLabels[field.group] ? field.group : 'identity';
              if (!grouped.has(key)) grouped.set(key, []);
              grouped.get(key).push(field);
            });
          return order
            .filter(key => grouped.has(key))
            .map(key => ({ key, label: groupLabels[key], fields: grouped.get(key) }));
        });
        return { advancedGroups, fieldError, fieldPath, fieldValue, patch, pathKey, primaryFields };
      },
      template: `
        <div class="skill-designer-vue-panel">
          <div class="skill-designer-vue-field-grid">
            <SkillFieldShell
              v-for="field in primaryFields"
              :key="field.id || field.key"
              :descriptor="field"
              :input-id="instanceId + '-' + (field.id || field.key)"
              :field-path="pathKey(fieldPath(field))"
              :error="fieldError(field)"
            >
              <SkillFieldControl
                :descriptor="field"
                :model-value="fieldValue(field)"
                :disabled="disabled"
                :instance-id="instanceId + '-' + (field.id || field.key)"
                :input-id="instanceId + '-' + (field.id || field.key)"
                :invalid="!!fieldError(field)"
                :described-by="fieldError(field) ? instanceId + '-' + (field.id || field.key) + '-error' : ''"
                @update:model-value="patch(field, $event)"
              />
            </SkillFieldShell>
          </div>
          <details
            v-for="group in advancedGroups"
            :key="group.key"
            class="skill-designer-vue-advanced-fields"
          >
            <summary>
              <span>{{ group.label }}</span>
              <b>{{ group.fields.length }} 项</b>
              <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
            </summary>
            <div class="skill-designer-vue-field-grid">
              <SkillFieldShell
                v-for="field in group.fields"
                :key="field.id || field.key"
                :descriptor="field"
                :input-id="instanceId + '-' + (field.id || field.key)"
                :field-path="pathKey(fieldPath(field))"
                :error="fieldError(field)"
              >
                <SkillFieldControl
                  :descriptor="field"
                  :model-value="fieldValue(field)"
                  :disabled="disabled"
                  :instance-id="instanceId + '-' + (field.id || field.key)"
                  :input-id="instanceId + '-' + (field.id || field.key)"
                  :invalid="!!fieldError(field)"
                  :described-by="fieldError(field) ? instanceId + '-' + (field.id || field.key) + '-error' : ''"
                  @update:model-value="patch(field, $event)"
                />
              </SkillFieldShell>
            </div>
          </details>
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
        collapseMode: { type: String, default: 'normal' },
        revealPath: { type: String, default: '' },
        errorPaths: { type: Array, default: () => [] },
      },
      emits: ['patch', 'structure', 'view'],
      template: `
        <div class="skill-designer-vue-panel">
          <section class="skill-designer-vue-section">
            <div class="skill-designer-vue-section-head">
              <div>
                <h3>效果原型</h3>
              </div>
              <div class="skill-designer-vue-section-actions">
                <button type="button" class="skill-designer-vue-text-button" :aria-pressed="collapseMode === 'all' ? 'true' : 'false'" :disabled="disabled" @click="$emit('view', 'all')">{{ collapseMode === 'all' ? '恢复展开' : '折叠全部' }}</button>
                <button type="button" class="skill-designer-vue-text-button" :aria-pressed="collapseMode === 'errors' ? 'true' : 'false'" :disabled="disabled" @click="$emit('view', 'errors')">{{ collapseMode === 'errors' ? '恢复展开' : '仅展开错误' }}</button>
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
              :collapse-mode="collapseMode"
              :reveal-path="revealPath"
              :error-paths="errorPaths"
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

    const SkillBasicPanel = createSkillFieldPanel('SkillBasicPanel');
    const SkillCostPanel = createSkillFieldPanel('SkillCostPanel');
    const SkillDescriptionPanel = createSkillFieldPanel('SkillDescriptionPanel');

    const SkillCostSummary = defineComponent({
      name: 'SkillCostSummary',
      props: {
        result: { type: Object, default: () => ({}) },
      },
      emits: ['locate'],
      setup(props) {
        const preview = computed(() => props.result?.preview || {});
        const budget = computed(() => preview.value.budget || null);
        const rows = computed(() => [
          ...(Array.isArray(preview.value.resourceRows) ? preview.value.resourceRows : []),
          ...(Array.isArray(preview.value.timingRows) ? preview.value.timingRows : []),
        ]);
        return { budget, preview, rows };
      },
      template: `
        <section class="skill-designer-vue-cost-summary" aria-labelledby="skill-cost-summary-title">
          <div class="skill-designer-vue-cost-summary-head">
            <div>
              <span class="skill-designer-vue-eyebrow">编译结果</span>
              <h2 id="skill-cost-summary-title">复杂度预算</h2>
            </div>
            <strong
              class="skill-designer-vue-cost-total"
              :class="{ danger: budget && budget.ok === false }"
            >{{ budget ? budget.label : '待评估' }}</strong>
          </div>
          <div v-if="rows.length" class="skill-designer-vue-cost-rows">
            <div v-for="row in rows" :key="row.label" class="skill-designer-vue-cost-row">
              <span>{{ row.label }}</span>
              <strong>{{ row.value }}<small v-if="row.unit"> {{ row.unit }}</small></strong>
            </div>
          </div>
          <p v-else class="skill-designer-vue-cost-empty">填写资源或时间参数后，这里会显示编译结果。</p>
          <div v-if="preview.effectRows?.length" class="skill-designer-vue-cost-effects">
            <button
              v-for="effect in preview.effectRows.slice(0, 8)"
              :key="effect.path"
              type="button"
              class="skill-designer-vue-cost-effect"
              @click="$emit('locate', { tab: 'effect', path: effect.path })"
            >
              <span>{{ effect.relation || '主效果' }}</span>
              <strong>{{ effect.title }}</strong>
              <small v-if="effect.detail">{{ effect.detail }}</small>
            </button>
          </div>
        </section>
      `,
    });

    const SkillDescriptionReference = defineComponent({
      name: 'SkillDescriptionReference',
      props: {
        result: { type: Object, default: () => ({}) },
      },
      setup(props) {
        const summary = computed(() => normalizeText(props.result?.preview?.summary, '填写效果后，这里会显示现有编译链生成的参考摘要。'));
        return { summary };
      },
      template: `
        <section class="skill-designer-vue-description-reference" aria-labelledby="skill-description-reference-title">
          <div>
            <span class="skill-designer-vue-eyebrow">现有编译链参考</span>
            <h2 id="skill-description-reference-title">自动生成参考</h2>
          </div>
          <p>{{ summary }}</p>
          <small>这是只读参考，不会覆盖你已经手动填写的描述。</small>
        </section>
      `,
    });

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
        statusText: { type: String, default: '未修改' },
        statusTone: { type: String, default: '' },
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
            <small class="skill-designer-vue-status" :class="statusTone">
              <span>{{ statusText }}</span>
              <b v-if="dirty && statusText !== '有未保存更改'">未保存</b>
            </small>
          </div>
          <div class="skill-designer-vue-toolbar-actions">
            <SkillCombobox
              v-if="switchItems.length > 1"
              :model-value="previewKey"
              :options="switchOptions"
              :disabled="busy"
              label="技能"
              trigger-text="切换技能"
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
          </button>
        </div>
      `,
    });

    const SkillDesignerApp = defineComponent({
      name: 'SkillDesignerApp',
      components: {
        SkillBasicPanel,
        SkillCostPanel,
        SkillCostSummary,
        SkillDescriptionPanel,
        SkillDescriptionReference,
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
        const statusText = shallowRef(dirty.value ? '已恢复草稿' : '未修改');
        const compileResult = shallowRef({
          normalizedDraft: cloneValue(rawDraft),
          nextSkill: null,
          preview: {},
          errors: [],
          warnings: [],
          transformations: [],
        });
        const collapseMode = shallowRef('normal');
        const revealPath = shallowRef('');
        const rootElement = shallowRef(null);
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
        const errorPaths = computed(() => (compileResult.value.errors || []).filter(error => error && error.path));
        const pageMeta = computed(() => ({
          basic: {
            title: '基础',
            description: '先确定技能身份、承载方式和会随承载方式变化的附加参数。',
          },
          effect: {
            title: '效果',
            description: '先建立主效果，再用条件、追加、替换和副作用表达完整效果链。',
          },
          cost: {
            title: '消耗',
            description: '调整资源和时间参数，并核对编译结果提供的复杂度预算来源。',
          },
          description: {
            title: '描述',
            description: '确认技能发动时的画面描述和最终效果描述。',
          },
        }[activeTab.value] || {}));
        const budgetSummary = computed(() => {
          const budget = compileResult.value?.preview?.budget;
          if (!budget) return '预算待评估';
          return `${Number(budget.actual || 0).toFixed(1)} / ${Number(budget.limit || 0).toFixed(1)}`;
        });
        const statusTone = computed(() => {
          if (['存在错误', '保存失败', '重新读取失败', '切换失败'].includes(statusText.value)) return 'error';
          if (statusText.value === '存在警告') return 'warning';
          if (['校验通过', '保存成功'].includes(statusText.value)) return 'success';
          return '';
        });

        function objectKey(object, prefix = 'item') {
          if (!object || typeof object !== 'object') return `${prefix}-${String(object)}`;
          if (!objectKeys.has(object)) objectKeys.set(object, `${prefix}-${++objectKeySeed}`);
          return objectKeys.get(object);
        }

        function findPathTarget(root, path) {
          const rawPath = Array.isArray(path) ? pathKey(path) : String(path || '');
          if (!root || !rawPath) return null;
          const escapedPath = rawPath.replace(/"/g, '\\"');
          return root.querySelector(`[data-field-path="${escapedPath}"]`)
            || root.querySelector(`[data-field-path^="${escapedPath}."]`)
            || root.querySelector(`[data-prototype-path="${escapedPath}"]`)
            || root.querySelector(`[data-prototype-path^="${escapedPath}."]`);
        }

        function openAncestorDetails(target) {
          let details = target?.closest?.('details');
          while (details) {
            details.open = true;
            details = details.parentElement?.closest?.('details') || null;
          }
        }

        function openErrorDetails(result) {
          const errors = Array.isArray(result?.errors) ? result.errors : [];
          if (!errors.some(error => error && error.path)) return;
          nextTick(() => {
            const root = document.getElementById(props.instanceId);
            errors.forEach(error => openAncestorDetails(findPathTarget(root, error && error.path)));
          });
        }

        function markChanged() {
          dirty.value = true;
          statusText.value = '有未保存更改';
          previewToken.value += 1;
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
          let focusPath = '';
          if (command.type === 'add-prototype') {
            const nestingDepth = command.path.filter(segment => typeof segment === 'string' && /效果$/.test(segment)).length;
            const maxCount = nestingDepth > 0
              ? Number(props.context.editorModel.nestedPrototypeLimit || 4)
              : Number(props.context.editorModel.prototypeLimit || 99);
            if (nestingDepth >= 2 || list.length >= maxCount) return;
            createUndo(command.path);
            list.push(props.context.actions.createPrototype({ path: command.path, draft: cloneValue(rawDraft) }));
            focusPath = pathKey([...command.path, list.length - 1]);
          } else if (command.type === 'duplicate') {
            const maxCount = command.path.length === 1
              ? Number(props.context.editorModel.prototypeLimit || 99)
              : Number(props.context.editorModel.nestedPrototypeLimit || 4);
            if (list.length >= maxCount || command.index < 0 || command.index >= list.length) return;
            createUndo(command.path);
            list.splice(command.index + 1, 0, cloneValue(list[command.index]));
            focusPath = pathKey([...command.path, command.index + 1]);
          } else if (command.type === 'add-side-effect') {
            createUndo(command.path);
            list.push(props.context.editorModel.createSideEffect());
          } else if (command.type === 'add-branch') {
            if (list.length >= 3) return;
            createUndo(command.path);
            list.push(props.context.editorModel.createConditionBranch());
          } else if (command.type === 'add-condition') {
            createUndo(command.path);
            list.push(props.context.editorModel.createCondition());
          } else if (command.type === 'remove') {
            if (command.index < 0 || command.index >= list.length) return;
            createUndo(command.path);
            list.splice(command.index, 1);
          } else if (command.type === 'move-up' && command.index > 0) {
            createUndo(command.path);
            const item = list.splice(command.index, 1)[0];
            list.splice(command.index - 1, 0, item);
          } else if (command.type === 'move-down' && command.index < list.length - 1) {
            createUndo(command.path);
            const item = list.splice(command.index, 1)[0];
            list.splice(command.index + 1, 0, item);
          } else {
            return;
          }
          markChanged();
          if (focusPath) {
            nextTick(() => {
              const root = document.getElementById(props.instanceId);
              const escapedPath = focusPath.replace(/"/g, '\\"');
              root
                ?.querySelector(`[data-prototype-path="${escapedPath}"] .skill-designer-vue-combobox-trigger`)
                ?.focus?.();
            });
          }
        }

        function undo() {
          if (!undoRecord.value || busy.value) return;
          setAtPath(rawDraft, undoRecord.value.path, cloneValue(undoRecord.value.value));
          undoRecord.value = null;
          markChanged();
          liveMessage.value = '已撤销上一次结构操作。';
        }

        function setCollapseMode(mode) {
          const requested = mode === 'all' || mode === 'errors' ? mode : 'normal';
          collapseMode.value = collapseMode.value === requested ? 'normal' : requested;
          liveMessage.value = collapseMode.value === 'all'
            ? '已折叠全部原型。'
            : collapseMode.value === 'errors'
              ? '已仅展开存在错误的原型。'
              : '已恢复原型展开状态。';
        }

        function locateItem(item = {}) {
          const tab = ['basic', 'effect', 'cost', 'description'].includes(item.tab) ? item.tab : 'effect';
          activeTab.value = tab;
          collapseMode.value = 'normal';
          revealPath.value = String(item.path || '');
          liveMessage.value = item.message || '已定位到相关字段。';
          nextTick(() => {
            const root = document.getElementById(props.instanceId);
            const target = findPathTarget(root, item.path);
            openAncestorDetails(target);
            const activePanel = root?.querySelector(`[data-skill-tab="${tab}"]`);
            const focusTarget =
              target?.querySelector('input, textarea, button, [tabindex]') ||
              target ||
              activePanel?.querySelector('input, textarea, button, [tabindex]');
            focusTarget?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
            focusTarget?.focus?.();
            revealPath.value = '';
          });
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
          if (!destroyed.value) statusText.value = '正在校验';
          try {
            const result = await Promise.resolve(
              props.context.actions.compileDraft(cloneValue(rawDraft), { dryRun: true }),
            );
            if (destroyed.value || token !== previewToken.value) return;
            compileResult.value = result || compileResult.value;
            openErrorDetails(compileResult.value);
            statusText.value = compileResult.value.errors?.length
              ? '存在错误'
              : compileResult.value.warnings?.length
                ? '存在警告'
                : dirty.value
                  ? '有未保存更改'
                  : '校验通过';
          } catch (error) {
            if (destroyed.value || token !== previewToken.value) return;
            compileResult.value = {
              ...compileResult.value,
              errors: [{ tab: 'effect', message: error?.message || '预览编译失败。' }],
            };
            statusText.value = '存在错误';
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
          collapseMode.value = 'normal';
          revealPath.value = String(firstError.path || '');
          liveMessage.value = firstError.message || '请修正表单错误。';
          nextTick(() => {
            const root = document.getElementById(props.instanceId);
            const target = findPathTarget(root, firstError.path);
            openAncestorDetails(target);
            const activePanel = root?.querySelector(`[data-skill-tab="${activeTab.value}"]`);
            const focusTarget =
              target?.querySelector('input, textarea, button, [tabindex]') ||
              target ||
              activePanel?.querySelector('input, textarea, button, [tabindex]');
            focusTarget?.focus?.();
            revealPath.value = '';
          });
        }

        async function save() {
          if (busy.value) return;
          if (compileTimer) window.clearTimeout(compileTimer);
          compileTimer = 0;
          flushCache();
          previewToken.value += 1;
          busy.value = true;
          statusText.value = '正在保存';
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
              statusText.value = '保存失败';
              focusFirstError(compileResult.value);
              return;
            }
            dirty.value = false;
            skipUnmountCache = false;
            undoRecord.value = null;
            liveMessage.value = result?.message || '技能设计已保存。';
            statusText.value = '保存成功';
          } catch (error) {
            if (destroyed.value || token !== operationToken.value) return;
            skipUnmountCache = false;
            const result = error?.compileResult || {
              ...compileResult.value,
              errors: [{ tab: error?.tab || 'effect', path: error?.path || '', message: error?.message || '保存失败。' }],
            };
            compileResult.value = result;
            statusText.value = '保存失败';
            focusFirstError(result);
          } finally {
            if (!destroyed.value && token === operationToken.value) busy.value = false;
          }
        }

        async function reload() {
          if (busy.value) return;
          if (dirty.value) {
            const previousStatus = statusText.value;
            statusText.value = '重新读取确认';
            await nextTick();
            if (!window.confirm('当前设计尚未保存，确定重新读取吗？')) {
              statusText.value = previousStatus;
              return;
            }
          }
          clearTimers();
          previewToken.value += 1;
          busy.value = true;
          statusText.value = '正在重新读取';
          const token = ++operationToken.value;
          try {
            const nextDraft = await Promise.resolve(props.context.actions.reloadDraft());
            if (destroyed.value || token !== operationToken.value || !nextDraft) return;
            replaceReactiveObject(rawDraft, nextDraft);
            dirty.value = false;
            undoRecord.value = null;
            revision.value += 1;
            liveMessage.value = '已重新读取当前技能。';
            statusText.value = '未修改';
          } catch (error) {
            if (!destroyed.value && token === operationToken.value) {
              liveMessage.value = error?.message || '重新读取失败。';
              statusText.value = '重新读取失败';
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
          previewToken.value += 1;
          busy.value = true;
          const token = ++operationToken.value;
          try {
            await Promise.resolve(props.context.actions.switchSkill(previewKey));
          } catch (error) {
            if (!destroyed.value && token === operationToken.value) {
              statusText.value = '切换失败';
              liveMessage.value = error?.message || '切换技能失败，请重试。';
            }
          } finally {
            if (!destroyed.value && token === operationToken.value) busy.value = false;
          }
        }

        watch(revision, scheduleSideEffects, { flush: 'post' });
        onMounted(() => {
          compileNow();
        });
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
          budgetSummary,
          dirty,
          errorCounts,
          errorPaths,
          liveMessage,
          locateItem,
          objectKey,
          pageMeta,
          collapseMode,
          revealPath,
          rawDraft,
          reload,
          rootElement,
          save,
          setCollapseMode,
          statusTone,
          statusText,
          switchSkill,
          tabFields,
          tabs,
          undo,
          undoRecord,
        };
      },
      template: `
        <div :id="instanceId" ref="rootElement" class="skill-designer-vue-root">
          <SkillDesignerToolbar
            :title="rawDraft.name || context.previewMeta.label || '未命名技能'"
            :subtitle="context.previewMeta.category || context.previewMeta.scope || ''"
            :switch-items="context.switchItems"
            :preview-key="context.previewKey"
            :busy="busy"
            :dirty="dirty"
            :status-text="statusText"
            :status-tone="statusTone"
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
          <main class="skill-designer-vue-editor">
            <header class="skill-designer-vue-page-heading">
              <div>
                <span class="skill-designer-vue-eyebrow">{{ pageMeta.title }}</span>
                <h1>{{ pageMeta.title }}</h1>
                <p>{{ pageMeta.description }}</p>
              </div>
              <span
                v-if="errorCounts[activeTab]"
                class="skill-designer-vue-page-issue"
                :class="statusTone"
              >{{ errorCounts[activeTab] }} 个问题</span>
            </header>
            <section class="skill-designer-vue-page-canvas">
              <SkillBasicPanel
                v-show="activeTab === 'basic'"
                :draft="rawDraft"
                :fields="tabFields.basic"
                :error-paths="errorPaths"
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
                :collapse-mode="collapseMode"
                :reveal-path="revealPath"
                :error-paths="errorPaths"
                :id="instanceId + '-panel-effect'"
                :aria-labelledby="instanceId + '-tab-effect'"
                role="tabpanel"
                data-skill-tab="effect"
                @patch="applyPatch"
                @structure="applyStructure"
                @view="setCollapseMode"
              />
              <SkillCostPanel
                v-show="activeTab === 'cost'"
                :draft="rawDraft"
                :fields="tabFields.cost"
                :error-paths="errorPaths"
                :disabled="busy"
                :instance-id="instanceId + '-cost'"
                :id="instanceId + '-panel-cost'"
                :aria-labelledby="instanceId + '-tab-cost'"
                role="tabpanel"
                data-skill-tab="cost"
                @patch="applyPatch"
              />
              <SkillCostSummary
                v-if="activeTab === 'cost'"
                :result="compileResult"
                @locate="locateItem"
              />
              <SkillDescriptionPanel
                v-show="activeTab === 'description'"
                :draft="rawDraft"
                :fields="tabFields.description"
                :error-paths="errorPaths"
                :disabled="busy"
                :instance-id="instanceId + '-description'"
                :id="instanceId + '-panel-description'"
                :aria-labelledby="instanceId + '-tab-description'"
                role="tabpanel"
                data-skill-tab="description"
                @patch="applyPatch"
              />
              <SkillDescriptionReference
                v-if="activeTab === 'description'"
                :result="compileResult"
              />
            </section>
          </main>
          <footer class="skill-designer-vue-status-dock">
            <div class="skill-designer-vue-status-dock-summary">
              <span class="skill-designer-vue-dock-status" :class="statusTone">
                <i class="fa-solid fa-circle" aria-hidden="true"></i>
                {{ statusText }}
              </span>
              <span class="skill-designer-vue-dock-budget">
                <b>复杂度预算</b>
                <strong>{{ budgetSummary }}</strong>
              </span>
              <span v-if="compileResult.warnings?.length" class="skill-designer-vue-dock-note warning">
                <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                {{ compileResult.warnings.length }} 条警告
              </span>
              <span v-if="compileResult.errors?.length" class="skill-designer-vue-dock-note error">
                <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
                {{ compileResult.errors.length }} 个问题
              </span>
            </div>
            <button
              type="button"
              class="skill-designer-vue-button primary skill-designer-vue-save-dock"
              :disabled="busy || !!compileResult.errors?.length"
              @click="save"
            ><i class="fa-solid fa-floppy-disk" aria-hidden="true"></i>保存设计</button>
          </footer>
          <div class="skill-designer-vue-live-region" aria-live="assertive" aria-atomic="true">{{ liveMessage }}</div>
        </div>
      `,
    });

    return {
      SkillBasicPanel,
      SkillCombobox,
      SkillConditionBuilder,
      SkillCostPanel,
      SkillCostSummary,
      SkillDescriptionPanel,
      SkillDescriptionReference,
      SkillDesignerApp,
      SkillDesignerTabs,
      SkillDesignerToolbar,
      SkillDurationInput,
      SkillEffectPanel,
      SkillFieldControl,
      SkillFieldShell,
      SkillHelpButton,
      SkillMatcherObject,
      SkillMultiSelect,
      SkillPrototypeEditor,
      SkillPrototypeList,
      SkillSegmentedControl,
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
