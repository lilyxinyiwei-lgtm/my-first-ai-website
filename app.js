'use strict';

(() => {
  const STORAGE_KEY = 'my-life-dashboard.tasks.v1';
  const categories = ['毕业论文', '求职实习', '日常生活'];
  const priorities = ['high', 'medium', 'low'];
  const priorityLabels = { high: '高优先级', medium: '中优先级', low: '低优先级' };
  const $ = (id) => document.getElementById(id);
  let tasks = [];
  let category = 'all';
  let status = 'all';
  let editingId = null;
  let deletingId = null;
  let toastTimer;
  const localDate = (date = new Date()) => `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const validDate = (value) => {
    if (value === '') return true;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
    const date = new Date(`${value}T12:00:00`);
    return !Number.isNaN(date.getTime()) && localDate(date) === value;
  };
  function notify(message, persistent = false) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').hidden = false;
    if (!persistent) toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500);
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      const ids = new Set();
      if (!Array.isArray(parsed) || !parsed.every((task) => {
        if (!task || typeof task.id !== 'string' || !task.id || ids.has(task.id) || typeof task.title !== 'string' || !task.title.trim() || task.title.length > 120 || !categories.includes(task.category) || typeof task.completed !== 'boolean' || !validDate(task.dueDate) || typeof task.createdAt !== 'number' || !Number.isFinite(task.createdAt)) return false;
        ids.add(task.id);
        return true;
      })) throw new Error('Invalid saved tasks');
      // Keep the existing storage key and all task fields. Legacy tasks default to medium.
      // Normalize in memory; persist only with the user's next successful task change.
      tasks = parsed.map((task) => ({
        ...task,
        priority: priorities.includes(task.priority) ? task.priority : 'medium'
      }));
    }
  } catch (error) {
    notify('无法读取本地任务。为保护原有数据，请先不要添加任务；尝试重新打开浏览器或检查浏览器存储设置。', true);
    // Do not overwrite unreadable data when the user opens this page.
    $('add-task').disabled = true;
    $('empty-add').disabled = true;
  }
  function save(nextTasks, message) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextTasks));
    } catch (error) {
      notify('保存失败：浏览器存储不可用或空间不足。本次修改尚未保存，请检查浏览器设置后重试。', true);
      return false;
    }
    tasks = nextTasks;
    render();
    notify(message);
    return true;
  }
  const icons = {
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m14 5 5 5M4 20l5-1 12-12a2 2 0 0 0-5-5L4 14z"/></svg>',
    delete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></svg>'
  };
  function render() {
    const total = tasks.length;
    const completed = tasks.filter((task) => task.completed).length;
    const percent = total ? Math.round(completed / total * 100) : 0;
    $('total-count').textContent = total;
    $('completed-count').textContent = completed;
    $('completion-rate').textContent = percent;
    $('progress-ring').style.setProperty('--progress', `${percent}%`);
    $('progress-caption').textContent = total && total === completed ? '所有任务已完成，给自己一个赞' : '不着急，每一步都在靠近目标';
    $('count-all').textContent = total;
    ['count-thesis', 'count-career', 'count-life'].forEach((id, index) => {
      $(id).textContent = tasks.filter((task) => task.category === categories[index]).length;
    });
    const label = category === 'all' ? '全部任务' : category;
    $('list-title').textContent = label;
    $('breadcrumb-category').textContent = label;
    const query = $('search').value.trim().toLocaleLowerCase();
    const visible = tasks.filter((task) => (category === 'all' || task.category === category) && (status === 'all' || (status === 'completed' ? task.completed : !task.completed)) && task.title.toLocaleLowerCase().includes(query));
    const sort = $('sort').value;
    visible.sort((a, b) => {
      if (sort === 'priority') {
        return priorities.indexOf(a.priority) - priorities.indexOf(b.priority) || b.createdAt - a.createdAt;
      }
      if (sort === 'due') {
        return (a.dueDate || '9999-99-99').localeCompare(b.dueDate || '9999-99-99') || b.createdAt - a.createdAt;
      }
      return b.createdAt - a.createdAt;
    });
    $('result-count').textContent = `${visible.length} 个任务`;
    $('list-summary').textContent = total ? `当前显示 ${visible.length} 项 · 还有 ${total - completed} 项待完成` : '你的计划，从这里开始';
    $('task-list').replaceChildren();
    const today = localDate();
    for (const task of visible) {
      const row = document.createElement('div');
      row.className = `task-row${task.completed ? ' done' : ''}`;
      const name = document.createElement('label');
      name.className = 'task-name';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = task.completed;
      checkbox.setAttribute('aria-label', `将“${task.title}”标记为${task.completed ? '待完成' : '已完成'}`);
      checkbox.addEventListener('change', () => {
        if (!save(tasks.map((item) => item.id === task.id ? { ...item, completed: checkbox.checked } : item), checkbox.checked ? '又完成了一件事，做得好！' : '已标记为待完成')) checkbox.checked = task.completed;
      });
      const title = document.createElement('span');
      title.className = 'task-text';
      title.textContent = task.title;
      name.append(checkbox, title);
      const badge = document.createElement('span');
      badge.className = `category-badge ${['badge-thesis', 'badge-career', 'badge-life'][categories.indexOf(task.category)]}`;
      badge.textContent = task.category;
      const priorityBadge = document.createElement('span');
      priorityBadge.className = `priority-badge priority-${task.priority}`;
      priorityBadge.textContent = priorityLabels[task.priority];
      const due = document.createElement('span');
      due.className = 'due-date';
      due.textContent = task.dueDate ? task.dueDate.replaceAll('-', '.') : '未设置日期';
      if (task.dueDate && !task.completed && task.dueDate <= today) {
        const note = document.createElement('small');
        due.classList.add(task.dueDate < today ? 'overdue' : 'today');
        note.textContent = task.dueDate < today ? '已逾期' : '今天截止';
        due.append(note);
      }
      const actions = document.createElement('div');
      actions.className = 'row-actions';
      for (const action of ['edit', 'delete']) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'icon-button';
        button.innerHTML = icons[action]; // Static icons only; task text always uses textContent.
        button.setAttribute('aria-label', `${action === 'edit' ? '编辑' : '删除'}任务：${task.title}`);
        button.title = action === 'edit' ? '编辑任务' : '删除任务';
        button.addEventListener('click', () => action === 'edit' ? openEditor(task) : openDelete(task));
        actions.append(button);
      }
      row.append(name, badge, priorityBadge, due, actions);
      $('task-list').append(row);
    }
    $('empty-state').hidden = visible.length > 0;
    const filtered = total > 0 || query || status !== 'all';
    $('empty-title').textContent = filtered ? '这里暂时没有任务' : '给今天，一个小小的目标';
    $('empty-description').textContent = filtered ? '试试其他分类、状态或搜索词，也可以添加一个新任务。' : '论文、实习，或是好好生活。把第一件事记在这里吧。';
    $('empty-add').textContent = filtered ? '＋ 添加任务' : '＋ 添加我的第一个任务';
  }
  function openEditor(task = null) {
    editingId = task ? task.id : null;
    $('task-form').reset();
    $('task-title').setCustomValidity('');
    $('dialog-title').textContent = task ? '编辑任务' : '添加任务';
    $('task-title').value = task ? task.title : '';
    $('task-category').value = task ? task.category : category === 'all' ? categories[0] : category;
    $('task-priority').value = task ? task.priority : 'medium';
    $('task-date').value = task ? task.dueDate : '';
    $('task-completed').checked = task ? task.completed : false;
    $('task-dialog').showModal();
    $('task-title').focus();
  }
  function openDelete(task) {
    deletingId = task.id;
    $('delete-description').textContent = `“${task.title}”将从你的任务列表中移除。`;
    $('delete-dialog').showModal();
    $('cancel-delete').focus();
  }
  $('add-task').addEventListener('click', () => openEditor());
  $('empty-add').addEventListener('click', () => openEditor());
  $('close-dialog').addEventListener('click', () => $('task-dialog').close());
  $('cancel-dialog').addEventListener('click', () => $('task-dialog').close());
  $('cancel-delete').addEventListener('click', () => $('delete-dialog').close());
  $('task-title').addEventListener('input', () => $('task-title').setCustomValidity(''));
  $('task-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const title = $('task-title').value.trim();
    if (!title) {
      $('task-title').setCustomValidity('请填写任务名称，不能只输入空格。');
      $('task-title').reportValidity();
      return;
    }
    const dueDate = $('task-date').value;
    if (!validDate(dueDate)) { notify('请填写有效的截止日期。'); return; }
    const priority = $('task-priority').value;
    if (!priorities.includes(priority)) { notify('请选择高、中或低优先级。'); return; }
    const existing = tasks.find((task) => task.id === editingId);
    const task = {
      ...existing,
      id: existing ? existing.id : globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title,
      category: $('task-category').value,
      priority,
      dueDate,
      completed: $('task-completed').checked,
      createdAt: existing ? existing.createdAt : Date.now()
    };
    const nextTasks = existing ? tasks.map((item) => item.id === existing.id ? task : item) : [...tasks, task];
    if (save(nextTasks, existing ? '任务已更新' : '任务已添加，向目标更近一步')) $('task-dialog').close();
  });
  $('delete-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (save(tasks.filter((task) => task.id !== deletingId), '任务已删除')) $('delete-dialog').close();
  });
  document.querySelectorAll('[data-category]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.category === category));
    button.addEventListener('click', () => {
      category = button.dataset.category;
      document.querySelectorAll('[data-category]').forEach((item) => {
        item.classList.toggle('active', item === button);
        item.setAttribute('aria-pressed', String(item === button));
      });
      render();
    });
  });
  document.querySelectorAll('[data-status]').forEach((button) => button.addEventListener('click', () => {
    status = button.dataset.status;
    document.querySelectorAll('[data-status]').forEach((item) => {
      item.classList.toggle('active', item === button);
      item.setAttribute('aria-pressed', String(item === button));
    });
    render();
  }));
  $('search').addEventListener('input', render);
  $('sort').addEventListener('change', render);
  function refreshDate() {
    const now = new Date();
    $('today').dateTime = localDate(now);
    $('today').textContent = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  }
  // Refresh overdue indicators when returning to the page or leaving it open overnight.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { refreshDate(); render(); } });
  setInterval(() => { refreshDate(); render(); }, 60000);
  refreshDate();
  render();
})();
