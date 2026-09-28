"""
gui.py — v2: interface com grade de categorias e três estados.
"""

import secrets
import string
import sys

from PySide6.QtCore import Qt, QTimer, QSize, QRegularExpression
from PySide6.QtGui import QAction, QRegularExpressionValidator, QFont
from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLineEdit, QPushButton, QListWidget, QListWidgetItem, QLabel,
    QDialog, QFormLayout, QComboBox, QTextEdit, QMessageBox, QFileDialog,
    QCheckBox, QGroupBox, QToolBar, QStackedWidget, QGridLayout,
    QScrollArea, QFrame, QSizePolicy,
)

from vault import Vault, VaultError, Entry
from schemas import (
    CATEGORIES, get_schema, get_display_title, get_title_field,
    is_masked, is_multiline,
)
from export_import import export_entries, preview_import, merge_into_vault, ExportImportError
from theme import load_app_font, build_stylesheet
from icons import category_icon

CLIPBOARD_CLEAR_SECONDS = 20


def generate_password(length=20):
    pool = string.ascii_letters + string.digits + "!@#$%^&*()-_=+[]{}?"
    return "".join(secrets.choice(pool) for _ in range(length))


# ---------------------------------------------------------------- login

class LoginDialog(QDialog):
    def __init__(self, vault_path, creating):
        super().__init__()
        self.vault_path = vault_path
        self.creating = creating
        self.vault = None
        self.setWindowTitle("Criar cofre" if creating else "Desbloquear cofre")
        self.setMinimumWidth(380)

        layout = QVBoxLayout(self)
        msg = ("Escolha uma senha-mestra forte. Ela não fica salva em "
               "lugar nenhum — se você esquecer, não há como recuperar "
               "os dados.") if creating else "Digite sua senha-mestra."
        info = QLabel(msg)
        info.setWordWrap(True)
        layout.addWidget(info)
        layout.addWidget(QLabel(f"Arquivo: {vault_path}"))

        self.pw1 = QLineEdit()
        self.pw1.setEchoMode(QLineEdit.Password)
        self.pw1.setPlaceholderText("Senha-mestra")
        layout.addWidget(self.pw1)

        if creating:
            self.pw2 = QLineEdit()
            self.pw2.setEchoMode(QLineEdit.Password)
            self.pw2.setPlaceholderText("Confirme a senha-mestra")
            layout.addWidget(self.pw2)

        self.error_label = QLabel("")
        self.error_label.setStyleSheet("color: #C0503D;")
        layout.addWidget(self.error_label)

        btn = QPushButton("Criar cofre" if creating else "Desbloquear")
        btn.setObjectName("Primary")
        btn.clicked.connect(self.on_submit)
        layout.addWidget(btn)
        self.pw1.returnPressed.connect(self.on_submit)

    def on_submit(self):
        pw = self.pw1.text()
        if not pw:
            self.error_label.setText("Digite uma senha.")
            return
        if self.creating:
            if len(pw) < 8:
                self.error_label.setText("Use pelo menos 8 caracteres.")
                return
            if pw != self.pw2.text():
                self.error_label.setText("As senhas não coincidem.")
                return
            try:
                self.vault = Vault.create_new(self.vault_path, pw)
            except VaultError as e:
                self.error_label.setText(str(e))
                return
        else:
            try:
                self.vault = Vault.load(self.vault_path, pw)
            except VaultError as e:
                self.error_label.setText(str(e))
                return
        self.accept()


# ---------------------------------------------------------------- editor de entrada

class EntryDialog(QDialog):
    def __init__(self, category, entry=None):
        super().__init__()
        self.setWindowTitle("Editar entrada" if entry else "Nova entrada")
        self.setMinimumWidth(460)
        self.category = category
        self.schema = get_schema(category)
        self.entry = entry
        self.field_widgets = {}

        layout = QVBoxLayout(self)

        cat_label = QLabel(f"Categoria: {category}")
        cat_label.setObjectName("Heading")
        layout.addWidget(cat_label)

        form = QFormLayout()
        for fdef in self.schema:
            name = fdef["name"]
            if is_multiline(fdef):
                w = QTextEdit()
                w.setFixedHeight(70)
                if entry:
                    w.setPlainText(entry.get_field(name))
            else:
                w = QLineEdit()
                if is_masked(fdef):
                    w.setEchoMode(QLineEdit.Password)
                if fdef.get("format") == "mm/aa":
                    w.setPlaceholderText("mm/aa")
                    w.setMaxLength(5)
                    w.setValidator(QRegularExpressionValidator(
                        QRegularExpression(r"[\d/]{0,5}")))
                    w.textChanged.connect(lambda text, widget=w: self._format_date(text, widget))
                if fdef.get("max_length"):
                    w.setMaxLength(fdef["max_length"])
                if fdef.get("validator"):
                    w.setValidator(QRegularExpressionValidator(
                        QRegularExpression(fdef["validator"])))
                if entry:
                    w.setText(entry.get_field(name))
            self.field_widgets[name] = w
            form.addRow(name, w)

        layout.addLayout(form)

        # Checkbox mostrar/gerar
        ctrl_row = QHBoxLayout()
        show_cb = QCheckBox("Mostrar campos sensíveis")
        show_cb.toggled.connect(self._toggle_visibility)
        ctrl_row.addWidget(show_cb)
        gen_btn = QPushButton("Gerar senha")
        gen_btn.setAutoDefault(False)
        gen_btn.setDefault(False)
        gen_btn.clicked.connect(self._on_generate)
        ctrl_row.addWidget(gen_btn)
        ctrl_row.addStretch()
        layout.addLayout(ctrl_row)

        self.error_label = QLabel("")
        self.error_label.setStyleSheet("color: #C0503D;")
        self.error_label.setWordWrap(True)
        layout.addWidget(self.error_label)

        btn_row = QHBoxLayout()
        save_btn = QPushButton("Salvar")
        save_btn.setObjectName("Primary")
        save_btn.setAutoDefault(True)
        save_btn.setDefault(True)
        save_btn.clicked.connect(self._on_save)
        cancel_btn = QPushButton("Cancelar")
        cancel_btn.setAutoDefault(False)
        cancel_btn.setDefault(False)
        cancel_btn.clicked.connect(self.reject)
        btn_row.addWidget(save_btn)
        btn_row.addWidget(cancel_btn)
        layout.addLayout(btn_row)

    def _format_date(self, text, widget):
        digits = "".join(ch for ch in text if ch.isdigit())[:4]
        fmt = digits[:2] + "/" + digits[2:] if len(digits) > 2 else digits
        if fmt != text:
            widget.blockSignals(True)
            widget.setText(fmt)
            widget.setCursorPosition(len(fmt))
            widget.blockSignals(False)

    def _toggle_visibility(self, show):
        mode = QLineEdit.Normal if show else QLineEdit.Password
        for fdef in self.schema:
            if is_masked(fdef):
                w = self.field_widgets[fdef["name"]]
                if isinstance(w, QLineEdit):
                    w.setEchoMode(mode)

    def _on_generate(self):
        # Encontrar o primeiro campo de senha e colocar lá
        for fdef in self.schema:
            if is_masked(fdef) and "senha" in fdef["name"].lower():
                w = self.field_widgets[fdef["name"]]
                if isinstance(w, QLineEdit):
                    w.setText(generate_password())
                    w.setEchoMode(QLineEdit.Normal)
                    return
        # Se não achou campo com "senha" no nome, gera no primeiro mascarado
        for fdef in self.schema:
            if is_masked(fdef):
                w = self.field_widgets[fdef["name"]]
                if isinstance(w, QLineEdit):
                    w.setText(generate_password())
                    w.setEchoMode(QLineEdit.Normal)
                    return

    def _on_save(self):
        self.error_label.setText("")
        title_field = get_title_field(self.category)
        title_w = self.field_widgets.get(title_field)
        title_val = ""
        if isinstance(title_w, QLineEdit):
            title_val = title_w.text().strip()
        elif isinstance(title_w, QTextEdit):
            title_val = title_w.toPlainText().strip()
        if not title_val:
            self.error_label.setText(f"Preencha o campo '{title_field}'.")
            return
        # Validação da Validade (mm/aa)
        for fdef in self.schema:
            if fdef.get("format") == "mm/aa":
                w = self.field_widgets[fdef["name"]]
                val = w.text().strip()
                if val and not QRegularExpression(r"^(0[1-9]|1[0-2])/\d{2}$").match(val).hasMatch():
                    self.error_label.setText(f"{fdef['name']} deve estar no formato mm/aa (ex.: 08/29).")
                    return
            if fdef.get("max_length") and fdef.get("validator") and "\\d" in fdef["validator"]:
                w = self.field_widgets[fdef["name"]]
                val = w.text().strip()
                if val and len(val) < 3:
                    self.error_label.setText(f"{fdef['name']} deve ter pelo menos 3 dígitos.")
                    return
        self.accept()

    def get_fields(self) -> dict:
        result = {}
        for fdef in self.schema:
            name = fdef["name"]
            w = self.field_widgets[name]
            if isinstance(w, QTextEdit):
                val = w.toPlainText().strip()
            else:
                val = w.text().strip() if isinstance(w, QLineEdit) else ""
            if val:
                result[name] = val
        return result


# ---------------------------------------------------------------- exportar / importar

class ExportDialog(QDialog):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Exportar")
        self.setMinimumWidth(420)
        self.out_path = None

        layout = QVBoxLayout(self)
        intro = QLabel(
            "Defina uma senha de compartilhamento para proteger o arquivo "
            "exportado. Combine essa senha por um canal diferente do usado "
            "para enviar o arquivo."
        )
        intro.setWordWrap(True)
        layout.addWidget(intro)

        self.cat_list = QListWidget()
        self.cat_list.setIconSize(QSize(28, 28))
        for cat in CATEGORIES:
            item = QListWidgetItem(category_icon(cat, size=32), cat)
            item.setFlags(item.flags() | Qt.ItemIsUserCheckable)
            item.setCheckState(Qt.Checked)
            self.cat_list.addItem(item)
        layout.addWidget(QLabel("Categorias a exportar:"))
        layout.addWidget(self.cat_list)

        select_row = QHBoxLayout()
        all_btn = QPushButton("Marcar todas")
        all_btn.setAutoDefault(False)
        all_btn.clicked.connect(lambda: self._set_all(Qt.Checked))
        none_btn = QPushButton("Desmarcar todas")
        none_btn.setAutoDefault(False)
        none_btn.clicked.connect(lambda: self._set_all(Qt.Unchecked))
        select_row.addWidget(all_btn)
        select_row.addWidget(none_btn)
        layout.addLayout(select_row)

        self.pw1 = QLineEdit()
        self.pw1.setEchoMode(QLineEdit.Password)
        self.pw1.setPlaceholderText("Senha de compartilhamento (mín. 8 caracteres)")
        self.pw2 = QLineEdit()
        self.pw2.setEchoMode(QLineEdit.Password)
        self.pw2.setPlaceholderText("Confirme a senha")
        layout.addWidget(self.pw1)
        layout.addWidget(self.pw2)

        self.error_label = QLabel("")
        self.error_label.setStyleSheet("color: #C0503D;")
        self.error_label.setWordWrap(True)
        layout.addWidget(self.error_label)

        btn_row = QHBoxLayout()
        export_btn = QPushButton("Exportar")
        export_btn.setObjectName("Primary")
        export_btn.setAutoDefault(True)
        export_btn.clicked.connect(self.on_export)
        cancel_btn = QPushButton("Cancelar")
        cancel_btn.setAutoDefault(False)
        cancel_btn.clicked.connect(self.reject)
        btn_row.addWidget(export_btn)
        btn_row.addWidget(cancel_btn)
        layout.addLayout(btn_row)

    def _set_all(self, state):
        for i in range(self.cat_list.count()):
            self.cat_list.item(i).setCheckState(state)

    def selected_categories(self):
        return [self.cat_list.item(i).text()
                for i in range(self.cat_list.count())
                if self.cat_list.item(i).checkState() == Qt.Checked]

    def on_export(self):
        cats = self.selected_categories()
        if not cats:
            self.error_label.setText("Selecione ao menos uma categoria.")
            return
        pw = self.pw1.text()
        if len(pw) < 8:
            self.error_label.setText("Senha de compartilhamento: mínimo 8 caracteres.")
            return
        if pw != self.pw2.text():
            self.error_label.setText("As senhas não coincidem.")
            return
        path, _ = QFileDialog.getSaveFileName(self, "Salvar", "export.pvault", "PassVault Export (*.pvault)")
        if not path:
            return
        if not path.endswith(".pvault"):
            path += ".pvault"
        self.out_path = path
        self.share_passphrase = pw
        self.categories = cats
        self.accept()


class ImportDialog(QDialog):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Importar e mesclar")
        self.setMinimumWidth(420)
        self.in_path = None

        layout = QVBoxLayout(self)
        info = QLabel("Escolha o arquivo .pvault e digite a senha de compartilhamento.")
        info.setWordWrap(True)
        layout.addWidget(info)

        file_row = QHBoxLayout()
        self.file_label = QLabel("Nenhum arquivo selecionado")
        pick_btn = QPushButton("Escolher arquivo...")
        pick_btn.setAutoDefault(False)
        pick_btn.clicked.connect(self.on_pick)
        file_row.addWidget(self.file_label, 1)
        file_row.addWidget(pick_btn)
        layout.addLayout(file_row)

        self.pw = QLineEdit()
        self.pw.setEchoMode(QLineEdit.Password)
        self.pw.setPlaceholderText("Senha de compartilhamento")
        layout.addWidget(self.pw)

        self.error_label = QLabel("")
        self.error_label.setStyleSheet("color: #C0503D;")
        self.error_label.setWordWrap(True)
        layout.addWidget(self.error_label)

        btn_row = QHBoxLayout()
        import_btn = QPushButton("Importar e mesclar")
        import_btn.setObjectName("Primary")
        import_btn.setAutoDefault(True)
        import_btn.clicked.connect(self.on_import)
        cancel_btn = QPushButton("Cancelar")
        cancel_btn.setAutoDefault(False)
        cancel_btn.clicked.connect(self.reject)
        btn_row.addWidget(import_btn)
        btn_row.addWidget(cancel_btn)
        layout.addLayout(btn_row)

    def on_pick(self):
        path, _ = QFileDialog.getOpenFileName(self, "Escolher .pvault", "", "PassVault Export (*.pvault);;Todos (*)")
        if path:
            self.in_path = path
            self.file_label.setText(path)

    def on_import(self):
        if not self.in_path:
            self.error_label.setText("Escolha um arquivo.")
            return
        if not self.pw.text():
            self.error_label.setText("Digite a senha.")
            return
        try:
            self.payload = preview_import(self.in_path, self.pw.text())
        except ExportImportError as e:
            self.error_label.setText(str(e))
            return
        self.accept()


# ---------------------------------------------------------------- janela principal

class MainWindow(QMainWindow):
    def __init__(self, vault):
        super().__init__()
        self.vault = vault
        self.setWindowTitle("PassVault")
        self.resize(740, 620)
        self._selected_entry = None
        self._current_category = None
        self._clipboard_timer = QTimer(self)
        self._clipboard_timer.setSingleShot(True)
        self._clipboard_timer.timeout.connect(self._clear_clipboard)

        # Toolbar
        toolbar = QToolBar()
        self.addToolBar(toolbar)
        for name, handler in [("Bloquear", self.on_lock),
                               ("Exportar", self.on_export),
                               ("Importar e mesclar", self.on_import)]:
            action = QAction(name, self)
            action.triggered.connect(handler)
            toolbar.addAction(action)

        central = QWidget()
        self.setCentralWidget(central)
        root = QVBoxLayout(central)

        # Busca
        self.search_box = QLineEdit()
        self.search_box.setPlaceholderText("Buscar por qualquer campo (inclusive senha)...")
        self.search_box.returnPressed.connect(self._on_search)
        self.search_box.textChanged.connect(self._on_search_changed)
        root.addWidget(self.search_box)

        # Área central com 3 estados
        self.stack = QStackedWidget()
        root.addWidget(self.stack, 1)

        # Estado 1: grade de categorias
        self._build_category_grid()

        # Estado 2: lista de entradas (usado para categoria e busca)
        self._build_entry_list()

        # Painel de detalhes (abaixo da lista, dentro do estado 2)
        # Já incluído no _build_entry_list

        # Barra de ações inferior
        action_bar = QHBoxLayout()
        self.btn_show = QPushButton("Mostrar/Ocultar")
        self.btn_show.clicked.connect(self._toggle_detail_visibility)
        self.btn_new = QPushButton("＋ Nova entrada")
        self.btn_new.setObjectName("Primary")
        self.btn_new.clicked.connect(self.on_new)
        self.btn_edit = QPushButton("Editar")
        self.btn_edit.clicked.connect(self.on_edit)
        self.btn_delete = QPushButton("Excluir")
        self.btn_delete.setObjectName("Danger")
        self.btn_delete.clicked.connect(self.on_delete)
        action_bar.addWidget(self.btn_show)
        action_bar.addWidget(self.btn_new)
        action_bar.addWidget(self.btn_edit)
        action_bar.addWidget(self.btn_delete)
        root.addLayout(action_bar)

        self.stack.setCurrentIndex(0)

    def _build_category_grid(self):
        page = QWidget()
        grid = QGridLayout(page)
        grid.setSpacing(14)
        grid.setContentsMargins(30, 30, 30, 30)
        cols = 5
        for i, cat in enumerate(CATEGORIES):
            btn = QPushButton(cat)
            btn.setIcon(category_icon(cat, size=48))
            btn.setIconSize(QSize(42, 42))
            btn.setMinimumHeight(80)
            btn.setMinimumWidth(120)
            btn.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
            font = btn.font()
            font.setPixelSize(13)
            btn.setFont(font)
            btn.setStyleSheet("""
                QPushButton { text-align: center; padding: 10px 6px; }
            """)
            btn.clicked.connect(lambda checked, c=cat: self._on_category_click(c))
            row, col = divmod(i, cols)
            grid.addWidget(btn, row, col)
        self.stack.addWidget(page)

    def _build_entry_list(self):
        page = QWidget()
        layout = QVBoxLayout(page)

        # Header com botão voltar
        header = QHBoxLayout()
        self.back_btn = QPushButton("← Voltar")
        self.back_btn.clicked.connect(self._go_home)
        self.back_btn.setAutoDefault(False)
        header.addWidget(self.back_btn)
        self.list_title = QLabel("")
        self.list_title.setObjectName("Heading")
        header.addWidget(self.list_title, 1)
        layout.addLayout(header)

        # Lista
        self.entry_list = QListWidget()
        self.entry_list.setIconSize(QSize(32, 32))
        self.entry_list.setMaximumHeight(200)
        self.entry_list.currentItemChanged.connect(self._on_entry_select)
        layout.addWidget(self.entry_list)

        # Detalhes
        self.detail_box = QGroupBox("Detalhes")
        self.detail_layout = QVBoxLayout(self.detail_box)
        self.detail_form = QFormLayout()
        self.detail_layout.addLayout(self.detail_form)
        self.detail_box.setVisible(False)

        # Scroll para detalhes em caso de muitos campos
        scroll = QScrollArea()
        scroll.setWidget(self.detail_box)
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.NoFrame)
        layout.addWidget(scroll, 1)

        self.stack.addWidget(page)

    # ---- navegação ----

    def _go_home(self):
        self._current_category = None
        self._selected_entry = None
        self.detail_box.setVisible(False)
        self.search_box.clear()
        self.stack.setCurrentIndex(0)

    def _on_category_click(self, category):
        self._current_category = category
        self.list_title.setText(category)
        self._refresh_entry_list(self.vault.search("", category))
        self.stack.setCurrentIndex(1)

    def _on_search(self):
        text = self.search_box.text().strip()
        if not text:
            return
        self._current_category = None
        self.list_title.setText(f"Busca: \"{text}\"")
        self._refresh_entry_list(self.vault.search(text))
        self.stack.setCurrentIndex(1)

    def _on_search_changed(self, text):
        if not text.strip():
            if self.stack.currentIndex() == 1 and not self._current_category:
                self._go_home()

    def _refresh_entry_list(self, entries):
        self.entry_list.clear()
        self._selected_entry = None
        self.detail_box.setVisible(False)
        for e in entries:
            subtitle = e.category
            item = QListWidgetItem(f"  {e.display_title}\n  {subtitle}")
            item.setIcon(category_icon(e.category, size=36))
            item.setData(Qt.UserRole, e.id)
            self.entry_list.addItem(item)

    # ---- detalhes ----

    def _on_entry_select(self, *_):
        item = self.entry_list.currentItem()
        if not item:
            self._selected_entry = None
            self.detail_box.setVisible(False)
            return
        entry_id = item.data(Qt.UserRole)
        entry = next((e for e in self.vault.entries if e.id == entry_id), None)
        if not entry:
            return
        self._selected_entry = entry
        self._show_detail(entry)

    def _show_detail(self, entry):
        # Limpar form anterior
        while self.detail_form.rowCount() > 0:
            self.detail_form.removeRow(0)

        self._detail_widgets = []
        schema = get_schema(entry.category)

        for fdef in schema:
            name = fdef["name"]
            value = entry.get_field(name)
            if not value:
                continue  # regra: esconde se vazio no painel de consulta

            row_layout = QHBoxLayout()
            if is_multiline(fdef):
                w = QTextEdit()
                w.setPlainText(value)
                w.setReadOnly(True)
                w.setFixedHeight(60)
                row_layout.addWidget(w, 1)
            elif is_masked(fdef):
                w = QLineEdit(value)
                w.setReadOnly(True)
                w.setEchoMode(QLineEdit.Password)
                row_layout.addWidget(w, 1)
            else:
                w = QLabel(value)
                w.setTextInteractionFlags(Qt.TextSelectableByMouse)
                w.setWordWrap(True)
                row_layout.addWidget(w, 1)

            # Botão copiar ao lado de cada campo
            copy_btn = QPushButton("Copiar")
            copy_btn.setFixedWidth(60)
            copy_btn.setAutoDefault(False)
            copy_val = value
            copy_btn.clicked.connect(lambda checked, v=copy_val: self._copy_to_clipboard(v))
            row_layout.addWidget(copy_btn)

            container = QWidget()
            container.setLayout(row_layout)
            self.detail_form.addRow(name, container)
            self._detail_widgets.append((fdef, w))

        self.detail_box.setVisible(True)

    def _toggle_detail_visibility(self):
        for fdef, w in getattr(self, '_detail_widgets', []):
            if is_masked(fdef) and isinstance(w, QLineEdit):
                mode = w.echoMode()
                w.setEchoMode(QLineEdit.Normal if mode == QLineEdit.Password else QLineEdit.Password)

    def _copy_to_clipboard(self, text):
        if not text:
            return
        QApplication.clipboard().setText(text)
        self._clipboard_timer.start(CLIPBOARD_CLEAR_SECONDS * 1000)
        self.statusBar().showMessage(
            f"Copiado. Área de transferência será limpa em {CLIPBOARD_CLEAR_SECONDS}s.", 3000)

    def _clear_clipboard(self):
        QApplication.clipboard().setText("")

    # ---- ações ----

    def on_new(self):
        cat = self._current_category or "Senhas"
        dlg = EntryDialog(cat)
        if dlg.exec() == QDialog.Accepted:
            self.vault.add_entry(cat, dlg.get_fields())
            self.vault.save()
            if self._current_category:
                self._on_category_click(self._current_category)
            else:
                self._go_home()

    def on_edit(self):
        e = self._selected_entry
        if not e:
            return
        dlg = EntryDialog(e.category, entry=e)
        if dlg.exec() == QDialog.Accepted:
            self.vault.update_entry(e.id, fields=dlg.get_fields())
            self.vault.save()
            if self._current_category:
                self._on_category_click(self._current_category)
            else:
                self._on_search()

    def on_delete(self):
        e = self._selected_entry
        if not e:
            return
        if QMessageBox.question(self, "Confirmar",
                f'Excluir "{e.display_title}" permanentemente?') == QMessageBox.Yes:
            self.vault.delete_entry(e.id)
            self.vault.save()
            self._selected_entry = None
            if self._current_category:
                self._on_category_click(self._current_category)
            else:
                self._go_home()

    def on_lock(self):
        self.vault.lock()
        self.close()

    def on_export(self):
        dlg = ExportDialog()
        if dlg.exec() != QDialog.Accepted:
            return
        try:
            count = export_entries(self.vault, dlg.out_path, dlg.share_passphrase, dlg.categories)
        except Exception as e:
            QMessageBox.critical(self, "Erro", str(e))
            return
        QMessageBox.information(self, "Exportado", f"{count} entrada(s) exportada(s).")

    def on_import(self):
        dlg = ImportDialog()
        if dlg.exec() != QDialog.Accepted:
            return
        summary = merge_into_vault(self.vault, dlg.payload)
        self.vault.save()
        msg = (f"Adicionadas: {summary.added}\n"
               f"Atualizadas: {summary.updated}\n"
               f"Ignoradas: {summary.skipped}")
        if summary.possible_duplicates:
            msg += f"\n\n{len(summary.possible_duplicates)} possível(is) duplicata(s) encontrada(s)."
        QMessageBox.information(self, "Importação concluída", msg)
        self._go_home()

    def closeEvent(self, event):
        self._clear_clipboard()
        event.accept()