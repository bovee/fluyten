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
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import ArrowDropDown from '@mui/icons-material/ArrowDropDown';
import ExpandMore from '@mui/icons-material/ExpandMore';
import Delete from '@mui/icons-material/Delete';
import Edit from '@mui/icons-material/Edit';
import FileDownload from '@mui/icons-material/FileDownload';
import Settings from '@mui/icons-material/Settings';

import { parseAbcFile } from './io/abcImport';
import { toAbc } from './io/abcExport';
import { fromMusicXml, extractMxl } from './io/musicXmlImport';
import { getStarterBookUrl } from './instrument';
import { ScaleDialog } from './scales/ScaleDialog';
import { SettingsDialog } from './SettingsDialog';
import { type Song } from './music';
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
  const [scaleDialogBookId, setScaleDialogBookId] = useState<string | null>(
    null
  );
  const [addSongMenu, setAddSongMenu] = useState<{
    anchor: HTMLElement;
    bookId: string;
  } | null>(null);
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
  const [importUrlBookId, setImportUrlBookId] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importFileBookId, setImportFileBookId] = useState<string | null>(null);
  const [addBookMenuAnchor, setAddBookMenuAnchor] =
    useState<HTMLElement | null>(null);
  const importNewBookFileRef = useRef<HTMLInputElement>(null);

  const userBooks = useStore((state) => state.userBooks);
  const addUserBook = useStore((state) => state.addUserBook);
  const removeUserBook = useStore((state) => state.removeUserBook);
  const renameUserBook = useStore((state) => state.renameUserBook);
  const addSongToBook = useStore((state) => state.addSongToBook);
  const removeSongFromBook = useStore((state) => state.removeSongFromBook);

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

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !importFileBookId) return;
    e.target.value = '';
    const name = file.name.toLowerCase();
    const isMusicXml =
      name.endsWith('.musicxml') ||
      name.endsWith('.xml') ||
      name.endsWith('.mxl');
    if (isMusicXml) {
      try {
        let xmlText: string;
        if (name.endsWith('.mxl')) {
          const buffer = await file.arrayBuffer();
          xmlText = extractMxl(buffer);
        } else {
          xmlText = await file.text();
        }
        const music = fromMusicXml(xmlText);
        const title = music.title || file.name.replace(/\.[^.]+$/, '');
        addSongToBook(importFileBookId, {
          id: crypto.randomUUID(),
          title,
          abc: `X:1\n${toAbc(music)}`,
        });
      } catch (err) {
        console.error('Failed to import MusicXML:', err);
      }
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        const tunes = parseAbcFile(text);
        tunes.forEach(({ title, abc }) => {
          addSongToBook(importFileBookId!, {
            id: crypto.randomUUID(),
            title,
            abc,
          });
        });
      };
      reader.readAsText(file);
    }
  };

  const handleImportNewBookFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const bookTitle = file.name.replace(/\.[^.]+$/, '');
    const name = file.name.toLowerCase();
    const isMusicXml =
      name.endsWith('.musicxml') ||
      name.endsWith('.xml') ||
      name.endsWith('.mxl');
    if (isMusicXml) {
      try {
        let xmlText: string;
        if (name.endsWith('.mxl')) {
          const buffer = await file.arrayBuffer();
          xmlText = extractMxl(buffer);
        } else {
          xmlText = await file.text();
        }
        const music = fromMusicXml(xmlText);
        const title = music.title || bookTitle;
        addUserBook(title);
        const newBookId = useStore.getState().userBooks.at(-1)!.id;
        addSongToBook(newBookId, {
          id: crypto.randomUUID(),
          title,
          abc: `X:1\n${toAbc(music)}`,
        });
      } catch (err) {
        console.error('Failed to import MusicXML:', err);
      }
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        const tunes = parseAbcFile(text);
        if (tunes.length === 0) return;
        addUserBook(tunes[0].title || bookTitle);
        const newBookId = useStore.getState().userBooks.at(-1)!.id;
        tunes.forEach(({ title, abc }) => {
          addSongToBook(newBookId, { id: crypto.randomUUID(), title, abc });
        });
      };
      reader.readAsText(file);
    }
  };

  const handleImportUrl = async () => {
    setImportUrlError(null);
    if (!importUrlBookId) return;
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
      const urlPath = new URL(importUrlValue).pathname.toLowerCase();
      const isMusicXml =
        urlPath.endsWith('.musicxml') ||
        urlPath.endsWith('.xml') ||
        urlPath.endsWith('.mxl');
      if (isMusicXml) {
        const text = await response.text();
        const music = fromMusicXml(text);
        const filename =
          importUrlValue.split('/').pop()?.split('?')[0] ?? 'Imported';
        const title = music.title || filename.replace(/\.[^.]+$/, '');
        addSongToBook(importUrlBookId, {
          id: crypto.randomUUID(),
          title,
          abc: `X:1\n${toAbc(music)}`,
        });
      } else {
        const text = await response.text();
        const tunes = parseAbcFile(text);
        tunes.forEach(({ title, abc }) => {
          addSongToBook(importUrlBookId!, {
            id: crypto.randomUUID(),
            title,
            abc,
          });
        });
      }
      setImportUrlDialogOpen(false);
      setImportUrlValue('');
      setImportUrlBookId(null);
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
                      setAddSongMenu({
                        anchor: e.currentTarget,
                        bookId: book.id,
                      })
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
              setImportFileBookId(bookId);
              setAddSongMenu(null);
              importFileRef.current?.click();
            }}
          >
            {t('importFromFile')}
          </MenuItem>
          <MenuItem
            onClick={() => {
              const bookId = addSongMenu!.bookId;
              setImportUrlBookId(bookId);
              setImportUrlValue(
                getStarterBookUrl(useStore.getState().instrumentType)
              );
              setAddSongMenu(null);
              setImportUrlDialogOpen(true);
            }}
          >
            {t('importAbcUrl')}
          </MenuItem>
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
              aria-label={t('addOtherBook')}
              onClick={(e) => setAddBookMenuAnchor(e.currentTarget)}
            >
              <ArrowDropDown />
            </Button>
          </ButtonGroup>
          <input
            ref={importFileRef}
            type="file"
            accept=".abc,.txt,.musicxml,.xml,.mxl"
            style={{ display: 'none' }}
            onChange={(e) => void handleImportFile(e)}
          />
          <input
            ref={importNewBookFileRef}
            type="file"
            accept=".abc,.txt,.musicxml,.xml,.mxl"
            style={{ display: 'none' }}
            onChange={(e) => void handleImportNewBookFile(e)}
          />
        </div>

        <Menu
          anchorEl={addBookMenuAnchor}
          open={Boolean(addBookMenuAnchor)}
          onClose={() => setAddBookMenuAnchor(null)}
        >
          <MenuItem
            onClick={() => {
              setAddBookMenuAnchor(null);
              importNewBookFileRef.current?.click();
            }}
          >
            {t('importAbc')}
          </MenuItem>
        </Menu>
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
          setImportUrlBookId(null);
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
              setImportUrlBookId(null);
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
