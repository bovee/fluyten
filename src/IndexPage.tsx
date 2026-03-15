import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Accordion from '@mui/material/Accordion';
import Box from '@mui/material/Box';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import ButtonGroup from '@mui/material/ButtonGroup';
import Divider from '@mui/material/Divider';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListSubheader from '@mui/material/ListSubheader';
import Tooltip from '@mui/material/Tooltip';
import ArrowDropDown from '@mui/icons-material/ArrowDropDown';
import ExpandMore from '@mui/icons-material/ExpandMore';
import Delete from '@mui/icons-material/Delete';
import Edit from '@mui/icons-material/Edit';
import FileDownload from '@mui/icons-material/FileDownload';
import Settings from '@mui/icons-material/Settings';

import { parseAbcFile } from './io/abcImport';
import { ScaleDialog } from './ScaleDialog';
import { SettingsDialog } from './SettingsDialog';
import { type Song, BUILT_IN_BOOKS } from './songs';
import { useStore, type UserBook, type UserSong } from './store';

interface IndexPageProps {
  onSelectSong: (song: Song, readOnly: boolean, bookId?: string) => void;
  expandedBook: string | false;
  onExpandedBookChange: (bookId: string | false) => void;
}

export function IndexPage({
  onSelectSong,
  expandedBook,
  onExpandedBookChange,
}: IndexPageProps) {
  const { t } = useTranslation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scaleDialogBookId, setScaleDialogBookId] = useState<string | null>(null);
  const [addSongMenu, setAddSongMenu] = useState<{ anchor: HTMLElement; bookId: string } | null>(null);
  const [newBookDialogOpen, setNewBookDialogOpen] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState('');
  const [renameBookId, setRenameBookId] = useState<string | null>(null);
  const [renameBookTitle, setRenameBookTitle] = useState('');
  const [deleteConfirmBookId, setDeleteConfirmBookId] = useState<string | null>(
    null
  );
  const [deleteConfirmSong, setDeleteConfirmSong] = useState<{
    bookId: string;
    songId: string;
    title: string;
  } | null>(null);
  const [exportBookId, setExportBookId] = useState<string | null>(null);
  const [exportFileName, setExportFileName] = useState('');
  const [importUrlDialogOpen, setImportUrlDialogOpen] = useState(false);
  const [importUrlValue, setImportUrlValue] = useState('');
  const [importUrlError, setImportUrlError] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const [addBuiltInMenuAnchor, setAddBuiltInMenuAnchor] =
    useState<null | HTMLElement>(null);

  const userBooks = useStore((state) => state.userBooks);
  const addUserBook = useStore((state) => state.addUserBook);
  const importUserBook = useStore((state) => state.importUserBook);
  const removeUserBook = useStore((state) => state.removeUserBook);
  const renameUserBook = useStore((state) => state.renameUserBook);
  const addSongToBook = useStore((state) => state.addSongToBook);
  const removeSongFromBook = useStore((state) => state.removeSongFromBook);

  const importedSourceIds = new Set(
    userBooks.map((b) => b.sourceId).filter(Boolean)
  );
  const availableBuiltInBooks = BUILT_IN_BOOKS.filter(
    (b) => !importedSourceIds.has(b.id)
  );

  const handleAccordionChange =
    (bookId: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
      onExpandedBookChange(isExpanded ? bookId : false);
    };

  const handleCreateBook = () => {
    if (!newBookTitle.trim()) return;
    addUserBook(newBookTitle.trim());
    setNewBookTitle('');
    setNewBookDialogOpen(false);
  };

  const handleRenameBook = () => {
    if (renameBookId && renameBookTitle.trim()) {
      renameUserBook(renameBookId, renameBookTitle.trim());
    }
    setRenameBookId(null);
    setRenameBookTitle('');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const bookTitle = file.name.replace(/\.[^.]+$/, '');
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const tunes = parseAbcFile(text);
      const songs: UserSong[] = tunes.map(({ title, abc }) => ({
        id: crypto.randomUUID(),
        title,
        abc,
      }));
      importUserBook(bookTitle, songs);
    };
    reader.readAsText(file);
    // Reset so the same file can be re-imported if needed
    e.target.value = '';
  };

  const handleImportUrl = async () => {
    setImportUrlError(null);
    try {
      new URL(importUrlValue);
    } catch {
      setImportUrlError(t('importUrlInvalidError'));
      return;
    }
    try {
      const response = await fetch(importUrlValue);
      if (!response.ok) {
        setImportUrlError(t('importUrlHttpError', { status: response.status }));
        return;
      }
      const text = await response.text();
      const tunes = parseAbcFile(text);
      const songs: UserSong[] = tunes.map(({ title, abc }) => ({
        id: crypto.randomUUID(),
        title,
        abc,
      }));
      const filename = importUrlValue.split('/').pop() ?? 'Imported';
      const bookTitle = filename.replace(/\.[^.]+$/, '');
      importUserBook(bookTitle, songs);
      setImportUrlDialogOpen(false);
      setImportUrlValue('');
    } catch {
      setImportUrlError(t('importUrlCorsError'));
    }
  };

  const handleAddSong = (bookId: string) => {
    const newSong: UserSong = {
      id: crypto.randomUUID(),
      title: 'New Song',
      abc: `X:1\nT:New Song\nM:C\nL:1/4\nK:C\nC D E F |`,
    };
    addSongToBook(bookId, newSong);
  };

  const openRenameBook = (book: UserBook, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameBookId(book.id);
    setRenameBookTitle(book.title);
  };

  const handleDeleteBook = (bookId: string) => {
    removeUserBook(bookId);
    setRenameBookId(null);
    setRenameBookTitle('');
    setDeleteConfirmBookId(null);
  };

  const openExport = (book: UserBook, e: React.MouseEvent) => {
    e.stopPropagation();
    setExportBookId(book.id);
    setExportFileName(book.title);
  };

  const handleExport = () => {
    const book = userBooks.find((b) => b.id === exportBookId);
    if (!book) return;
    const content = book.songs
      .map((song, i) => song.abc.replace(/^X:\s*\d+/m, `X:${i + 1}`))
      .join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportFileName || book.title}.abc`;
    a.click();
    URL.revokeObjectURL(url);
    setExportBookId(null);
  };

  return (
    <>
      {/* Page background */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: '#fffef9',
          zIndex: -2,
        }}
      />
      {/* Decorative treble clef watermark — uses Unicode 𝄞 from serif font */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          right: '4vw',
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '80vh',
          lineHeight: 1,
          color: '#1a1a1a',
          opacity: 0.05,
          zIndex: -1,
          pointerEvents: 'none',
          userSelect: 'none',
          fontFamily: 'Georgia, "Times New Roman", serif',
        }}
      >
        𝄞
      </div>

      <Tooltip title={t('settingsButton')}>
        <IconButton
          onClick={() => setSettingsOpen(true)}
          aria-label={t('settingsButton')}
          style={{ position: 'fixed', top: 8, right: 8 }}
        >
          <Settings />
        </IconButton>
      </Tooltip>
      <h1 style={{ color: '#1c3248' }}>{t('appTitle')}</h1>

      <div style={{ width: 'min(600px, 95vw)', margin: '0 auto' }}>
        {userBooks.map((book) => (
          <Accordion
            key={book.id}
            expanded={expandedBook === book.id}
            onChange={handleAccordionChange(book.id)}
            sx={{ backgroundColor: '#fffef9' }}
          >
            <AccordionSummary expandIcon={<ExpandMore />}>
              <strong>{book.title}</strong>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <List disablePadding>
                {book.songs.map((song) => (
                  <ListItem
                    key={song.id}
                    disablePadding
                    secondaryAction={
                      <Tooltip title={t('deleteSong')}>
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() =>
                            setDeleteConfirmSong({
                              bookId: book.id,
                              songId: song.id,
                              title: song.title,
                            })
                          }
                          aria-label={t('deleteSong')}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    }
                  >
                    <ListItemButton
                      onClick={() =>
                        onSelectSong(
                          { id: song.id, title: song.title, abc: song.abc },
                          false,
                          book.id
                        )
                      }
                    >
                      <ListItemText primary={song.title} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  m: 1,
                }}
              >
                <ButtonGroup size="small">
                  <Button onClick={() => handleAddSong(book.id)}>
                    {t('addSong')}
                  </Button>
                  <Button
                    size="small"
                    aria-label={t('addOtherSong')}
                    onClick={(e) =>
                      setAddSongMenu({ anchor: e.currentTarget, bookId: book.id })
                    }
                  >
                    <ArrowDropDown />
                  </Button>
                </ButtonGroup>
                <ButtonGroup size="small">
                  <Tooltip title={t('exportBook')}>
                    <Button
                      onClick={(e) => openExport(book, e)}
                      aria-label={t('exportBook')}
                    >
                      <FileDownload fontSize="small" />
                    </Button>
                  </Tooltip>
                  <Tooltip title={t('editBook')}>
                    <Button
                      onClick={(e) => openRenameBook(book, e)}
                      aria-label={t('editBook')}
                    >
                      <Edit fontSize="small" />
                    </Button>
                  </Tooltip>
                </ButtonGroup>
              </Box>
            </AccordionDetails>
          </Accordion>
        ))}

        <Menu
          anchorEl={addSongMenu?.anchor}
          open={Boolean(addSongMenu)}
          onClose={() => setAddSongMenu(null)}
        >
          <MenuItem
            onClick={() => {
              const bookId = addSongMenu!.bookId;
              setAddSongMenu(null);
              setScaleDialogBookId(bookId);
            }}
          >
            {t('generateScale')}
          </MenuItem>
        </Menu>

        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 16,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <ButtonGroup variant="outlined">
            <Button onClick={() => setNewBookDialogOpen(true)}>
              {t('addEmptyBook')}
            </Button>
            <Button
              size="small"
              onClick={(e) => setAddBuiltInMenuAnchor(e.currentTarget)}
              aria-label={t('addOtherBook')}
            >
              <ArrowDropDown />
            </Button>
          </ButtonGroup>
          <Menu
            anchorEl={addBuiltInMenuAnchor}
            open={Boolean(addBuiltInMenuAnchor)}
            onClose={() => setAddBuiltInMenuAnchor(null)}
          >
            <MenuItem
              onClick={() => {
                setAddBuiltInMenuAnchor(null);
                importFileRef.current?.click();
              }}
            >
              {t('importAbc')}
            </MenuItem>
            <MenuItem
              onClick={() => {
                setAddBuiltInMenuAnchor(null);
                setImportUrlDialogOpen(true);
              }}
            >
              {t('importAbcUrl')}
            </MenuItem>
            {availableBuiltInBooks.length > 0 && <Divider />}
            {availableBuiltInBooks.length > 0 && (
              <ListSubheader role="presentation">
                {t('builtInBooks')}
              </ListSubheader>
            )}
            {availableBuiltInBooks.map((book) => (
              <MenuItem
                key={book.id}
                onClick={() => {
                  const tunes = parseAbcFile(book.abc);
                  const songs: UserSong[] = tunes.map(({ title, abc }, i) => ({
                    id: crypto.randomUUID(),
                    title: t(`songs.${book.songKeys[i]}`, title),
                    abc,
                  }));
                  importUserBook(
                    t(`books.${book.id}`, book.title),
                    songs,
                    book.id
                  );
                  setAddBuiltInMenuAnchor(null);
                }}
              >
                {t(`books.${book.id}`, book.title)}
              </MenuItem>
            ))}
          </Menu>
          <input
            ref={importFileRef}
            type="file"
            accept=".abc,.txt"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
        </div>
      </div>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      <ScaleDialog
        open={scaleDialogBookId !== null}
        onClose={() => setScaleDialogBookId(null)}
        onCreate={(song) => {
          if (scaleDialogBookId) addSongToBook(scaleDialogBookId, song);
          setScaleDialogBookId(null);
        }}
      />

      <Dialog
        open={newBookDialogOpen}
        onClose={() => setNewBookDialogOpen(false)}
      >
        <DialogTitle>{t('createNewEmptyBook')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label={t('bookName')}
            value={newBookTitle}
            onChange={(e) => setNewBookTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCreateBook();
              }
            }}
            sx={{ mt: 1 }}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewBookDialogOpen(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleCreateBook} variant="contained">
            {t('create')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={renameBookId !== null}
        onClose={() => setRenameBookId(null)}
      >
        <DialogTitle>{t('editBook_title')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label={t('bookName')}
            value={renameBookTitle}
            onChange={(e) => setRenameBookTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRenameBook()}
            sx={{ mt: 1 }}
            fullWidth
          />
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between' }}>
          <Button
            color="error"
            onClick={() => renameBookId && setDeleteConfirmBookId(renameBookId)}
          >
            {t('deleteBook')}
          </Button>
          <div>
            <Button onClick={() => setRenameBookId(null)}>{t('cancel')}</Button>
            <Button onClick={handleRenameBook} variant="contained">
              {t('save')}
            </Button>
          </div>
        </DialogActions>
      </Dialog>
      <Dialog
        open={deleteConfirmSong !== null}
        onClose={() => setDeleteConfirmSong(null)}
      >
        <DialogTitle>{t('deleteSong')}</DialogTitle>
        <DialogContent>
          {t('confirmDeleteSong', { title: deleteConfirmSong?.title ?? '' })}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmSong(null)}>
            {t('cancel')}
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              if (deleteConfirmSong) {
                removeSongFromBook(
                  deleteConfirmSong.bookId,
                  deleteConfirmSong.songId
                );
                setDeleteConfirmSong(null);
              }
            }}
          >
            {t('deleteSong')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteConfirmBookId !== null}
        onClose={() => setDeleteConfirmBookId(null)}
      >
        <DialogTitle>{t('deleteBook')}</DialogTitle>
        <DialogContent>
          {t('confirmDeleteBook', {
            title:
              userBooks.find((b) => b.id === deleteConfirmBookId)?.title ?? '',
          })}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmBookId(null)}>
            {t('cancel')}
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() =>
              deleteConfirmBookId && handleDeleteBook(deleteConfirmBookId)
            }
          >
            {t('deleteBook')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={importUrlDialogOpen}
        onClose={() => {
          setImportUrlDialogOpen(false);
          setImportUrlValue('');
          setImportUrlError(null);
        }}
      >
        <DialogTitle>{t('importAbcUrl')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="URL"
            value={importUrlValue}
            onChange={(e) => setImportUrlValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleImportUrl();
              }
            }}
            error={importUrlError !== null}
            helperText={importUrlError}
            sx={{ mt: 1 }}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setImportUrlDialogOpen(false);
              setImportUrlValue('');
              setImportUrlError(null);
            }}
          >
            {t('cancel')}
          </Button>
          <Button onClick={() => void handleImportUrl()} variant="contained">
            {t('import')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={exportBookId !== null}
        onClose={() => setExportBookId(null)}
      >
        <DialogTitle>{t('exportAbc')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label={t('fileName')}
            value={exportFileName}
            onChange={(e) => setExportFileName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleExport()}
            sx={{ mt: 1 }}
            fullWidth
            slotProps={{ input: { endAdornment: '.abc' } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportBookId(null)}>{t('cancel')}</Button>
          <Button onClick={handleExport} variant="contained">
            {t('download')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
